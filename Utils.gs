function deleteTrigger() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'start_genai_process') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('Trigger for start_genai_process has been deleted');
    }
  });
}

function auth() {
  cache = CacheService.getUserCache();
  token = ScriptApp.getOAuthToken();  
  cache.put("token", token);
}

/**
 * Identifies the next cell coordinates in a Google Spreadsheet.
 * 
 * @returns {Array<number>|null} - An array containing two numbers [rowNumber, columnNumber] representing
 *                                 the coordinates of the next cell to be processed. Returns null if 
 *                                 no appropriate keys are found in the document properties.
 */
function next_cell_run() {
  const data = PropertiesService.getDocumentProperties().getProperties();
  const formatRegex = /^\d+-\d+$/;

  const filteredKeys = Object.keys(data).filter(key => formatRegex.test(key));
  
  filteredKeys.sort((a, b) => parseInt(a.split('-')[0], 10) - parseInt(b.split('-')[0], 10));

  if (filteredKeys.length > 0) {
    const [rowNumber, columnNumber] = filteredKeys[0].split('-').map(Number);
    return [rowNumber, columnNumber];
  } else {
    return null;
  }
}

