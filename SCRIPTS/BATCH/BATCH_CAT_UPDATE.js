/*------------------------------------------------------------------------------------------------------/
| Program: BATCH_CAT_UPDATE
| Version 1.0 - Base Version.
|
| Script to run nightly to send license updates to CAT
| Batch job name: CAT Nightly Update
/
/*------------------------------------------------------------------------------------------------------/
|
| START: USER CONFIGURABLE PARAMETERS
|
/------------------------------------------------------------------------------------------------------*/
//lwacht: 180418: story 5411: moving to batch folder, cleaning up
var maxSeconds = 4 * 60;				// number of seconds allowed for batch processing, usually < 5*60
var useAppSpecificGroupName = false;	// Use Group name when populating App Specific Info Values
var useTaskSpecificGroupName = true;	// Use Group name when populating Task Specific Info Values
var currentUserID = "ADMIN";
var publicUser = null;
var systemUserObj = aa.person.getUser("ADMIN").getOutput();
var showDebug = true;	

var vScriptName = aa.env.getValue("ScriptCode");
var vEventName = aa.env.getValue("EventName");

var startDate = new Date();
var startTime = startDate.getTime();
var timeExpired = false;
var message = "";						// Message String
var debug = "";							// Debug String
var br = "<BR>";						// Break Tag
var emailText = "";
var catAPIChunkSize = 10;

eval(getMasterScriptText("INCLUDES_ACCELA_FUNCTIONS"));
eval(getScriptText("INCLUDES_BATCH"));
eval(getMasterScriptText("INCLUDES_CUSTOM"));

override = "function logDebug(dstr){ if(showDebug) { aa.print(dstr); emailText+= dstr + \"<br>\"; } }";
eval(override);

function getScriptText(vScriptName){
	vScriptName = vScriptName.toUpperCase();
	var emseBiz = aa.proxyInvoker.newInstance("com.accela.aa.emse.emse.EMSEBusiness").getOutput();
	var emseScript = emseBiz.getScriptByPK(aa.getServiceProviderCode(),vScriptName,"ADMIN");
	return emseScript.getScriptText() + "";
}

function getMasterScriptText(vScriptName) {
	vScriptName = vScriptName.toUpperCase();
	var emseBiz = aa.proxyInvoker.newInstance("com.accela.aa.emse.emse.EMSEBusiness").getOutput();
	var emseScript = emseBiz.getMasterScript(aa.getServiceProviderCode(), vScriptName);
	return emseScript.getScriptText() + "";
}

/*------------------------------------------------------------------------------------------------------/
|
| END: USER CONFIGURABLE PARAMETERS
|
/------------------------------------------------------------------------------------------------------*/
//Needed HERE to log parameters below in eventLog
var sysDate = aa.date.getCurrentDate();
var batchJobID = aa.batchJob.getJobID().getOutput();
var batchJobName = "" + aa.env.getValue("batchJobName");

aa.env.setValue("emailAddress", "lwacht@trustvip.com");
aa.env.setValue("baseUrl", "https://testing-services-ca.metrc.com/licenses/facility");
aa.env.setValue("apiKey", "hwQLZPBs8-VvwY7DSxnzMIG7uEbmFUrfFsqEvYzqOT-3IXtg");
aa.env.setValue("sysFromEmail", "calcannabislicensing@cdfa.ca.gov");

var emailAddress = aa.env.getValue("emailAddress"); // email address to send failures
var baseUrl = aa.env.getValue("baseUrl"); // base url for CAT API
var apiKey = aa.env.getValue("apiKey"); // key for CAT API
var sysFromEmail = getParam("sysFromEmail");


/*----------------------------------------------------------------------------------------------------/
|
| Start: BATCH PARAMETERS
|
/------------------------------------------------------------------------------------------------------*/
//
// Your variables go here
// Ex. var appGroup = getParam("Group");
//
/*----------------------------------------------------------------------------------------------------/
|
| End: BATCH PARAMETERS
|-----------------------------------------------------------------------------------------------------+/
/*------------------------------------------------------------------------------------------------------/
| <===========Main=Loop================>
|
/-----------------------------------------------------------------------------------------------------*/


var SET_ID = "CAT_UPDATES";

try {
    var theSet = aa.set.getSetByPK(SET_ID).getOutput();
    var status = theSet.getSetStatus();
    var setId = theSet.getSetID();
    var memberResult = aa.set.getCAPSetMembersByPK(SET_ID);
    if (!memberResult.getSuccess()) {
        logDebug("**WARNING** error retrieving set members " + memberResult.getErrorMessage());
    } else {
        var members = memberResult.getOutput().toArray();
        var size = members.length;
        if (members.length > 0) {
            var compositeResult = {
                totalCount: size,
                activeCount: 0,
                inactiveCount: 0,
                errorRecordCount: 0,
                errorRecords: [],
                errors: []
            };
            logDebug("capSet: loaded set " + setId + " of status " + status + " with " + size + " records");
            var licenseNos = capIdsToLicenseNos(members);
            var start, end, licenseNosChunk;
            for (start = 0, end = licenseNos.length; start < end; start += catAPIChunkSize) { //chunk calls to the API
				if (elapsed() > maxSeconds) { // only continue if time hasn"t expired
					logDebug("WARNING: A script timeout has caused partial completion of this process.  Please re-run.  " + elapsed() + " seconds elapsed, " + maxSeconds + " allowed.") ;
					timeExpired = true ;
					break; 
				}
                licenseNosChunk = licenseNos.slice(start, start + catAPIChunkSize);
                var putResult = initiateCatPut(licenseNosChunk, String(baseUrl), String(apiKey));
                if (putResult.getSuccess()) {
                    var resultObject = putResult.getOutput();
                    removeFromSet(licenseNosToCapIds(licenseNosChunk), resultObject.errorRecords);
                    compositeResult = {
                        totalCount: compositeResult.totalCount,
                        activeCount: compositeResult.activeCount + resultObject.activeCount,
                        inactiveCount: compositeResult.inactiveCount + resultObject.inactiveCount,
                        errorRecordCount: compositeResult.errorRecordCount + resultObject.errorRecordCount,
                        errorRecords: compositeResult.errorRecords.concat(resultObject.errorRecords),
                        errors: compositeResult.errors.concat(resultObject.errors)
                    };
                } else {
                    logDebug( "ERROR: " + putResult.getErrorType() + " " + putResult.getErrorMessage());
                }
            }
        } else {
            logDebug("Completed successfully: No records to process");
        }
    }
	logDebug("End of Job: Elapsed Time : " + elapsed() + " Seconds");
} catch (err) {
    logDebug("ERROR: " + err.message + " In " + batchJobName);
    logDebug("Stack: " + err.stack);
}

/*------------------------------------------------------------------------------------------------------/
| <===========Internal Functions and Classes (Used by this script)
/------------------------------------------------------------------------------------------------------*/

function capIdsToLicenseNos(capIdArray) {
    var licenseNoArray = [];
    for (var i = 0, len = capIdArray.length; i < len; i++) {
        var licenseNo = aa.cap.getCap(capIdArray[i]).getOutput().getCapID().getCustomID();
        licenseNoArray.push(licenseNo.toString());
    }
    return licenseNoArray;
}

function licenseNosToCapIds(licenseNoArray) {
    var capIdArray = [];
    for (var i = 0, len = licenseNoArray.length; i < len; i++) {
        var capId = toCapId(licenseNoArray[i]);
        capIdArray.push(capId);
    }
    return capIdArray;
}

function toCapId(licenseNo) {
    return aa.cap.getCapID(licenseNo).getOutput();
}

function removeFromSet(capIds, errorLicenseNumbers) {
    for (var i = 0, len = capIds.length; i < len; i++) {
        var licenseNumber = toLicenseNumber(capIds[i]);
        if (contains(errorLicenseNumbers, licenseNumber)) {
            logDebug("error number " + licenseNumber + "/" + capIds[i] + " not removing from set");
        } else {
            var removeResult = aa.set.removeSetHeadersListByCap(SET_ID, capIds[i]);
            if (!removeResult.getSuccess()) {
                logDebug("**WARNING** error removing record from set " + SET_ID + " : " + removeResult.getErrorMessage());
            } else {
                logDebug("capSet: removed record " + capIds[i] + " from set " + SET_ID);
            }
        }
    }
}

function contains(stringArray, string) {
    for (var i = 0, len = stringArray.length; i < len; i++) {
        if (String(stringArray[i]) == String(string)) {
            return true;
        }
    }
    return false;
}


