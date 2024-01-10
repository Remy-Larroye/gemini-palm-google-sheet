/**
 * Invokes a Google GenAI model to generate content based on a given prompt. This function
 * makes a POST request to the appropriate Google GenAI API endpoint, depending on the specified model.
 * It handles token-based authentication, API request retries, and parses the response to extract
 * the generated content.
 *
 * @param {string} prompt - The input text prompt to be sent to the GenAI model for content generation.
 * @param {string} project_id - The Google Cloud project ID associated with the GenAI model.
 * @param {string} region - The Google Cloud region where the GenAI model is hosted (e.g., 'us-central1').
 * @param {string} model - The specific GenAI model to use. For example, 'gemini-pro' or other available models.
 * @param {number} temperature - The temperature setting for the GenAI model, controlling the randomness of the output.
 * @param {number} [maxRetries=10] - The maximum number of retries for the API request in case of failures. Default is 10.
 * @param {number} [baseDelay=1000] - The base delay (in milliseconds) before retrying after a failure. Default is 1000 ms.
 *
 * @returns {string|null} - Returns the generated content as a string from the GenAI model. If the API request fails
 *                          after all retries or if the API returns a non-200 status code, the function returns null.
 */
function callGoogleGenAI(prompt, project_id, region, model, temperature, maxRetries = 10, baseDelay = 1000) {
  const cache = CacheService.getUserCache();
  const token = cache.get("token");
  const baseUrl = `https://${region}-aiplatform.googleapis.com/v1/projects/${project_id}/locations/${region}/publishers/google/models/`;
  const url = model === "gemini-pro" ? 
              `${baseUrl}gemini-pro:streamGenerateContent` : 
              `${baseUrl}${model}:predict`;

  const data = model === "gemini-pro" ? {
    contents: { role: "USER", parts: { "text": prompt } },  
    generation_config: { temperature: temperature, topP: 1 }
  } : {
    instances: [{ prompt: prompt }],
    parameters: { temperature: temperature, maxOutputTokens: 256, topK: 40, topP: 0.95, logprobs: 2 }
  };

  const options = {
    method: "post",
    contentType: 'application/json',   
    headers: { Authorization: `Bearer ${token}` },
    payload: JSON.stringify(data),
    muteHttpExceptions: true,
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = UrlFetchApp.fetch(url, options);
    Logger.log(`Attempt: ${attempt}, Return Code: ${response.getResponseCode()}`)
    if (response.getResponseCode() == 200) {
      const json = JSON.parse(response.getContentText());
      return model === "gemini-pro" ? json[0].candidates[0].content.parts[0].text : json.predictions[0].content;
    } else if (response.getResponseCode() == 429) {
      if (attempt < maxRetries) {
        Logger.log(`Sleep before next attempt = ${baseDelay} ms`);
        Utilities.sleep(baseDelay);
      } else {
        return null;
      }
    } else {
      throw new Error(response);
    }
  }
  return null;
}
