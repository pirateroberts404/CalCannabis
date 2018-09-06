/*------------------------------------------------------------------------------------------------------/
| Program : ACA_ONLOAD_APPLICANT_OWNER_TABLE.js
| Event   : ACA Page Flow attachments before event
|
| Usage   : Master Script by Accela.  See accompanying documentation and release notes.
|
| Client  : N/A
| Action# : N/A
|
| Notes   :  Checks the values of first/last name against reference contacts with corresponding email
|
/------------------------------------------------------------------------------------------------------*/
/*------------------------------------------------------------------------------------------------------/
| START User Configurable Parameters
|
|     Only variables in the following section may be changed.  If any other section is modified, this
|     will no longer be considered a "Master" script and will not be supported in future releases.  If
|     changes are made, please add notes above.
/------------------------------------------------------------------------------------------------------*/
var showMessage = false; // Set to true to see results in popup window
var showDebug = false; // Set to true to see debug messages in popup window
var useAppSpecificGroupName = false; // Use Group name when populating App Specific Info Values
var useTaskSpecificGroupName = false; // Use Group name when populating Task Specific Info Values
var cancel = false;
var SCRIPT_VERSION = 3;
var useCustomScriptFile = true;  			// if true, use Events->Custom Script, else use Events->Scripts->INCLUDES_CUSTOM

/*------------------------------------------------------------------------------------------------------/
| END User Configurable Parameters
/------------------------------------------------------------------------------------------------------*/
var startDate = new Date();
var startTime = startDate.getTime();
var debug = ""; // Debug String
var br = "<BR>"; // Break Tag
var useSA = false;
var SA = null;
var SAScript = null;
var bzr = aa.bizDomain.getBizDomainByValue("MULTI_SERVICE_SETTINGS", "SUPER_AGENCY_FOR_EMSE");
if (bzr.getSuccess() && bzr.getOutput().getAuditStatus() != "I") {
	useSA = true;
	SA = bzr.getOutput().getDescription();
	bzr = aa.bizDomain.getBizDomainByValue("MULTI_SERVICE_SETTINGS", "SUPER_AGENCY_INCLUDE_SCRIPT");
	if (bzr.getSuccess()) {
		SAScript = bzr.getOutput().getDescription();
	}
}

if (SA) {
	eval(getScriptText("INCLUDES_ACCELA_FUNCTIONS", SA, useCustomScriptFile));
	eval(getScriptText("INCLUDES_ACCELA_GLOBALS", SA, true));
	eval(getScriptText(SAScript, SA));
} else {
	eval(getScriptText("INCLUDES_ACCELA_FUNCTIONS",null,useCustomScriptFile));
	eval(getScriptText("INCLUDES_ACCELA_GLOBALS", null,true));
}


eval(getScriptText("INCLUDES_CUSTOM",null,useCustomScriptFile));

function getScriptText(vScriptName, servProvCode, useProductScripts) {
	if (!servProvCode)  servProvCode = aa.getServiceProviderCode();
	vScriptName = vScriptName.toUpperCase();
	var emseBiz = aa.proxyInvoker.newInstance("com.accela.aa.emse.emse.EMSEBusiness").getOutput();
	try {
		if (useProductScripts) {
			var emseScript = emseBiz.getMasterScript(aa.getServiceProviderCode(), vScriptName);
		} else {
			var emseScript = emseBiz.getScriptByPK(aa.getServiceProviderCode(), vScriptName, "ADMIN");
		}
		return emseScript.getScriptText() + "";
	} catch (err) {
		return "";
	}
}

var cap = aa.env.getValue("CapModel");

// page flow custom code begin
try{
	//lwacht: 180306: story 5308: don't allow script to run against completed records
	var capIdStatusClass = getCapIdStatusClass(capId);
	if(!matches(capIdStatusClass, "COMPLETE")){
	//lwacht: 180306: story 5308: end
		loadASITables4ACA_corrected();
		var tblOwner = [];
		var tblCorrection = false;
		var correctLastName = false;
		var correctFirstName = false;
		if(OWNERS.length<1){
			var contactList = cap.getContactsGroup();
			if(contactList != null && contactList.size() > 0){
				var arrContacts = contactList.toArray();
				for(var i in arrContacts) {
					var thisCont = arrContacts[i];
					var emailText = "";
					//for(x in thisCont){
					//	if(typeof(thisCont[x])!="function"){
					//		logDebug(x+ ": " + thisCont[x]);
					//		emailText +=(x+ ": " + thisCont[x]) + br;
					//	}
					//}
					var contType = thisCont.contactType;
					if(contType =="Designated Responsible Party") {
						//var refContNrb = thisCont.refContactNumber;
						var drpContact = [];
						var drpFName = thisCont.firstName;
						var drpLName = thisCont.lastName;
						var drpEmail = thisCont.email;
						drpContact["First Name"]=new asiTableValObj("First Name", drpFName, "Y");
						drpContact["Last Name"]=new asiTableValObj("Last Name", drpLName, "Y");
						drpContact["Email Address"]=new asiTableValObj("Email Address", drpEmail, "Y");
						tblOwner.push(drpContact);
						var asit = cap.getAppSpecificTableGroupModel();
						addASITable4ACAPageFlow(asit, "OWNERS", tblOwner)
						addToASITable("OWNERS",tblOwner);
					}
				}
			}
		}
	}
}catch (err) {
    logDebug("A JavaScript Error occurred: ACA_ONLOAD_APPLICANT_OWNER_TABLE: Populate DRP: " + err.message);
	logDebug(err.stack);
	aa.sendMail(sysFromEmail, debugEmail, "", "An error has occurred in  ACA_ONLOAD_APPLICANT_OWNER_TABLE: Populate DRP: "+ startDate, capId + "; " + err.message+ "; "+ err.stack + br + currEnv);
}
try{
	//lwacht: ???? : 180904: make the owner table read-only if the application has gone past the review page
	var arrOwnRecds = getChildren("Licenses/Cultivator/*/Owner Application", capId);
	if(!matches(arrOwnRecds,null,"","undefined")){
		if(arrOwnRecds.length>0){
			loadASITables();
			//removeASITable("OWNERS"); 
			var tssmResult = aa.appSpecificTableScript.removeAppSpecificTableInfos("OWNERS",capId,"ADMIN")
			if (!tssmResult.getSuccess()){
				logDebug("**WARNING: error removing ASI table " + tableName + " " + tssmResult.getErrorMessage()) ;
			}else{
				logDebug("Successfully removed all rows from ASI Table: ");
			}

			var tempArray = new Array(); 
			tempArray =OWNERS; 
			for(own in tempArray){
				var drpContact = []; 
				var fName = ""+tempArray[own]["First Name"];
				var LName = ""+tempArray[own]["Last Name"];
				var eMail = ""+tempArray[own]["Email Address"];
				logDebug("fName: " + fName);
				logDebug("LName: " + LName);
				logDebug("eMail: " + eMail);
				drpContact["First Name"]=new asiTableValObj("First Name", "VOTE FOR PEDRO", "Y");
				drpContact["Last Name"]=new asiTableValObj("Last Name", LName, "Y");
				drpContact["Email Address"]=new asiTableValObj("Email Address", eMail, "Y");
				tblOwner.push(drpContact);
				var asit = cap.getAppSpecificTableGroupModel();
				addASITable4ACAPageFlow(asit, "OWNERS", tblOwner);
				addToASITable("OWNERS",tblOwner);
			}
			asit = cap.getAppSpecificTableGroupModel();
			//addASITable4ACAPageFlow(asit, "OWNERS",tempArray);
			//addASITable("OWNERS",tempArray);
			showMessage=true;
			logMessage("Changes to the owner table are not allowed at this point in the application process. Any changes made to the owner table at this time could result in delayed processing of your application. Please submit your entire application then contact CDFA to make any changes.");
			aa.sendMail(sysFromEmail, debugEmail, "", "INFO ONLY  ACA_ONLOAD_APPLICANT_OWNER_TABLE: Lock Owner Table: "+ startDate, capId + "; " + debug + br + currEnv);
		}
	}
	//lwacht: ???? : 180904: end
}catch (err) {
    logDebug("A JavaScript Error occurred: ACA_ONLOAD_APPLICANT_OWNER_TABLE: Lock Owner Table: " + err.message);
	logDebug(err.stack);
	aa.sendMail(sysFromEmail, debugEmail, "", "An error has occurred in  ACA_ONLOAD_APPLICANT_OWNER_TABLE: Lock Owner Table: "+ startDate, capId + "; " + err.message+ "; "+ err.stack + br + currEnv);
}
function getCapIdStatusClass(inCapId){
    var inCapScriptModel = aa.cap.getCap(inCapId).getOutput();
    var retClass = null;
    if(inCapScriptModel){
        var tempCapModel = inCapScriptModel.getCapModel();
        retClass = tempCapModel.getCapClass();
    }
   
    return retClass;
}

/*------------------------------------------------------------------------------------------------------/
| <===========END=Main=Loop================>
/-----------------------------------------------------------------------------------------------------*/

if (debug.indexOf("**ERROR") > 0) {
    aa.env.setValue("ErrorCode", "1");
    aa.env.setValue("ErrorMessage", debug);
}
else {
    if (cancel) {
        aa.env.setValue("ErrorCode", "-2");
        if (showMessage) aa.env.setValue("ErrorMessage", message);
        if (showDebug) aa.env.setValue("ErrorMessage", debug);
    }
    else {
        aa.env.setValue("ErrorCode", "0");
        if (showMessage) aa.env.setValue("ErrorMessage", message);
        if (showDebug) aa.env.setValue("ErrorMessage", debug);
    }
}

/*------------------------------------------------------------------------------------------------------/
| <===========External Functions (used by Action entries)
/------------------------------------------------------------------------------------------------------*/


