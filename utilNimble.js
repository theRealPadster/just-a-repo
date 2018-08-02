// ***********************************************************************
// *********** NIMBLE UTILITIES ******************************************
// ***********************************************************************

// *********** INITIALIZATION ********************************************

var promise = require("bluebird"),
  request = require("superagent-promise")(require("superagent"), promise),
  config = require("../config/global"),
  con = require("../lib/dbConnection");

module.exports = {
  fetchContactId: fetchContactId,
  updateContact: updateContact,
  updateSimpleFlag: updateSimpleFlag
};

// DB connections
var db = con.db;

// *********** PUBLIC FUNCTIONS *****************************************

/**
 * Grab contact id for Nimble from DB
 * @param {string} email Email to use to find Nimble ID from DB
 * @returns {Promise<string>}
 */
function fetchContactId(email) { // TODO - good spot to put the "add to nimble" call, since it's used everywhere?
  return db.one("SELECT nimble_id FROM users WHERE email = $1", [email])
  .then(result => result.nimble_id)
  .catch(function(err) {
    console.log(err);
  });
}

/**
 * Update contact in Nimble CRM
 * @param {string} contactId ID of Nimble contact
 * @param {object[]} fields Fields to update in Nimble contact
 * @param {boolean} replace Replace all fields currently in Nimble?
 */
function updateContact(contactId, fields, replace = false) {
  // Build request query
  var body = {
    fields: {},
    record_type: "person"
  };

  // Process fields into format expected by Nimble
  fields.forEach(field => {
    body.fields[field.key] = [{
      "value": field.value,
      "modifier": field.modifier
    }];
  });

  // Construct endpoint
  var endpoint = "https://app.nimble.com/api/v1/contact/" + contactId;
  endpoint += replace ? "?replace=1" : "";

  // Make request to Nimble API
  return promise.resolve(
    request
      .put(endpoint)
      .send(body)
      .set("Authorization", "Bearer " + config.nimble.API_KEY)
      .then(function(results) {
        return results.body;
      })
      .catch(function(error) {
        console.log(error);
      })
  );
}

/**
 * Update a simple boolean Nimble flag
 * @param {string} email Email of Nimble contact
 * @param {string} fieldName Name of the Nimble flag
 * @param {boolean} fieldValue Value of nimble flag (true = yes)
 */
function updateSimpleFlag(email, fieldName, fieldValue) {
  var nimbleFields = [
    {
      "key": fieldName,
      "value": fieldValue ? "yes" : "no",
      "modifier": ""
    }
  ];

  return fetchContactId(email)
  .then(nimbleId => {
    if (nimbleId)
      return updateContact(nimbleId, nimbleFields);
    else // If user doesn't exist in Nimble, ignore it
      throw new Error("not in nimble"); // TODO - add to nimble?
  }).then(results => {    
    var ret = { id: results.id }
    ret[fieldName] = `Flagged in Nimble: ${results.fields[fieldName][0]["value"]}`;
    return ret;
  }).catch(function(error) {
    if (error.message == "not in nimble")
      return `${email} does not exist in Nimble`;
    console.log(error);
  });
}
