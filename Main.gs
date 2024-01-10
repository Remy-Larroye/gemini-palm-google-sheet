
/**
 * This function integrates Google GenAI with a Google Spreadsheet to generate AI responses.
 * It takes a prompt from the active cell in the spreadsheet and sends it to Google GenAI for processing.
 * The function supports custom configurations for the GenAI request.
 *
 * @param {string} prompt - The input prompt to send to Google GenAI. This is typically the content of the active cell in the spreadsheet.
 * @param {string} [project="] - The Google Cloud project ID associated with the GenAI instance.
 * @param {string} [region="us-central1"] - The Google Cloud region where the GenAI project is hosted. Default is 'us-central1'.
 * @param {number} [temperature=0.1] - The temperature setting for the GenAI model, controlling the randomness of the output. Default is 0.1.
 * @param {string} [model="gemini-pro"] - The specific GenAI model to use. Default is 'gemini-pro'.
 *
 * @returns {string} - The response from Google GenAI. This could be the generated text or a status message such as "Will run soon ⏳".
 *                      In case of errors or if the process is still running, appropriate messages are returned.
 *
 * @customfunction
 */
function GEN_AI(prompt, project, region="us-central1", temperature=0.1, model="gemini-pro") {

  const rowNumber = SpreadsheetApp.getActiveSheet().getActiveCell().getRow(); 
  const columnNumber = SpreadsheetApp.getActiveSheet().getActiveCell().getColumn(); 

  PropertiesService.getDocumentProperties().setProperty(`${rowNumber}-${columnNumber}`,prompt );

  // Check that the authentication process process is running
  if (PropertiesService.getDocumentProperties().getProperty(`start_genai_process_running`) !== "true") {
    return "⚠️ Please start the process in menu GenAI -> Start GenAI if not already done"
  }

  var lock = LockService.getScriptLock(); // Run only one call at the time to avoid 429
  var lockAcquired = lock.tryLock(1000);
  if (lockAcquired) {
    try {
        var answer = callGoogleGenAI(prompt, project, region, model, temperature)
        lock.releaseLock();
        if (answer === null) {
          return "Will run soon ⏳"
        }
        PropertiesService.getDocumentProperties().deleteProperty(`${rowNumber}-${columnNumber}`);
        return answer
    } catch(e) {
      lock.releaseLock();
      throw e
    }
  } else {
    return "Will run soon ⏳"
  }
}

/**
 * Initiates and manages the process of generating AI responses using the GEN_AI function across a Google Spreadsheet.
 * This function is designed to periodically trigger AI response generation for different cells in the spreadsheet.
 * @customfunction
 */
function start_genai_process(){
  var start_run = new Date();
  max_run_time = 300000 // Maximum runtime for a function un app script is 6 minutes so take 5 minutes to take some take to finish the process

  PropertiesService.getDocumentProperties().setProperty(`start_genai_process_running`,"true");

  deleteTrigger() // Delete the trigger to ensure that the process run more than 6 minutes if needed
  auth() // Get the token for the VertexAI API

  var runNumber = 0;

  while((new Date().getTime() - start_run.getTime()) < max_run_time){

    rowAndColumn = next_cell_run()
    if (rowAndColumn !== null){
      Logger.log(`Start running cell : ${rowAndColumn}`)

      var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      var formula = sheet.getRange(rowAndColumn[0], rowAndColumn[1]).getFormula();  

      // Ensure that the cell contains a call to your custom function; this cannot be the case if the user deletes the cell.
      if (formula.startsWith('=GEN_AI(')) { 
        sheet.getRange(rowAndColumn[0], rowAndColumn[1]).clear();
        SpreadsheetApp.flush();
        sheet.getRange(rowAndColumn[0], rowAndColumn[1]).setFormula(formula);
        SpreadsheetApp.flush();
        runNumber++;
      }
      else {
        PropertiesService.getDocumentProperties().deleteProperty(`${rowAndColumn[0]}-${rowAndColumn[1]}`);
      }
    } else {
      Utilities.sleep(2000)
    }
  }

  // If the process do more than one call to GenAI we start another process for the next 5 minutes
  if (runNumber != 0) {
    var currentDate = new Date();
    currentDate.setSeconds(currentDate.getSeconds() + 10);
    ScriptApp.newTrigger('start_genai_process').timeBased().at(currentDate).create();
  } else {
    PropertiesService.getDocumentProperties().setProperty(`start_genai_process_running`,"false");
  }
}

/**
 * This function is triggered every time the Google Spreadsheet is opened.
 * It sets up the initial state for the GenAI process and adds a custom menu to the spreadsheet's UI.
 */
function onOpen() {
  PropertiesService.getDocumentProperties().setProperty(`start_genai_process_running`,"false");
  try {
    SpreadsheetApp.getUi().createMenu('GenAI')
        .addItem('Start GenAI', 'start_genai_process')
        .addToUi();
  } catch (e) {
    console.log('Failed with error: %s', e.error);
  }
}
