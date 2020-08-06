#!/usr/bin/env node

const chalk = require("chalk");
const rl = require("readline");
const PhoneNumber = require("awesome-phonenumber");

const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const format = require("string-format");
const request = require("request-promise");
const uuidv4 = require("uuid/v4");

const adapter = new FileSync("db.json");
const db = low(adapter);
const args = process.argv;
const commands = ["new", "remove", "reclaim", "list", "help"];
const languages = ["en", "sv", "no", "da", "fi"];
const countries = ["SE", "NO", "FI", "DK"];
format.extend(String.prototype, {});

var config = {
  apiKey: "591aa0cdb8cf85d41fede9b027b1e1c7",
  baseUrl: "https://appi.postnord.com/rest",
  headers: {
    "User-Agent": "PostNord/6.5.2-Android",
    Connection: "Keep-Alive",
    Host: "appi.postnord.com",
    "Accept-Encoding": "gzip",
    "Content-Type": "application/json; charset=UTF-8"
  }
};

const usage = function() {
  const usageText = `
    postnord-hash-generator helps you create, reclaim, remove and list MMM-Postnord subscriptions aka hashes.
  
    usage:
      postnord-hash-generator <command>
  
      commands can be:
  
      new:         used to create a new subscription/hashes
      remove:      used to remove an excisting subscription/hashes
      list:        used to list all subscriptions/hashes in MMM-Postnords configurations
      help:        used to print the usage guide

      allowed values for parameters:
      country:    'SE', 'NO', 'FI', 'DK'
      language:   'en', 'sv', 'no', 'da', 'fi'
    `;

  console.log(usageText);
};

function errorLog(error) {
  const eLog = chalk.red(error);
  console.log(eLog);
}

async function prompt(question) {
  const r = rl.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });
  return new Promise(async (resolve, error) => {
    r.question(question, answer => {
      r.close();
      resolve(answer);
    });
  });
}

async function addSubscription(subscriptionId, type, language, country) {
  if (getSubscription(subscriptionId, type).length === 0) {
    subscriptionIdFormatted = type === "phone" ? getPhoneNumberFormatted(subscriptionId, country) : subscriptionId;
    var deviceId = uuidv4();
    var register = await generateSubscription(
      deviceId,
      subscriptionIdFormatted,
      language,
      country
    );
    if (register.status && register.status == "success") {
      var subscriptions = db.get("subscriptions");
      subscriptions
        .push({
          subscriptionId: subscriptionId,
          subscriptionIdFormatted: subscriptionIdFormatted,
          type: type,
          deviceId: deviceId,
          language: language,
          country: country,
          status: "PENDING"
        })
        .write();
    }
  }
}

function deleteSubscription(subscriptionId, type) {
  if (getSubscription(subscriptionId, type).length > 0) {
    db.get("subscriptions")
      .remove({ subscriptionId: subscriptionId, type: type })
      .write();
    return true;
  }
  return false;
}

function validateSubscription(code, subscription) {
  return new Promise(resolve => {
    let options = {
      method: "POST",
      uri: "{0}/customer/v1/identity/validate/{1}?apikey={2}".format(
        config.baseUrl,
        subscription.subscriptionIdFormatted,
        config.apiKey
      ),
      headers: config.headers,
      json: true,
      body: {
        deviceid: subscription.deviceId,
        token: code
      }
    };
    request(options)
      .then(function(response) {
        if (response.hash) {
          subscription.hash = response.hash;
          subscription.status = "VERIFIED";
          db.get("subscriptions")
            .find({
              subscriptionId: subscription.subscriptionId,
              type: subscription.type
            })
            .assign(subscription)
            .write();
        }
        console.log("Subscription added: " + subscription.subscriptionId);
      })
      .catch(function(error) {
        console.log(
          "validateSubscription failed: {0}".format(JSON.stringify(error))
        );
      });
  });
}

async function verifySubscription(subscriptionId, type) {
  const ver = chalk.green(
    "Type in validation code that you will recive thru SMS or email:"
  );
  prompt(ver).then(code => {
    if (code.length === 4 && parseInt(code) > 0) {
      var subscription = getSubscription(subscriptionId, type)[0];
      validateSubscription(code, subscription);
    } else {
      errorLog("Input is not valid...");
    }
  });
}

function generateSubscription(deviceId, subscriptionId, language, country) {
  return new Promise(resolve => {
    let options = {
      method: "POST",
      uri: "{0}/customer/v1/identity/register/{1}?apikey={2}".format(
        config.baseUrl,
        subscriptionId,
        config.apiKey
      ),
      headers: config.headers,
      json: true,
      body: {
        deviceid: deviceId,
        language: language,
        country: country,
        licenseversion: 2
      }
    };
    request(options)
      .then(function(response) {
        resolve(response);
      })
      .catch(function(error) {
        console.log(
          "generateSubscription failed: {0}".format(JSON.stringify(error))
        );
      });
  });
}

function getSubscription(subscriptionId, type) {
  return db
    .get("subscriptions")
    .filter({ subscriptionId: subscriptionId, type: type })
    .value();
}

function listSubscriptions() {
  var subscriptions = db.get("subscriptions").value();

  if (subscriptions.length == 0) {
    console.log("No subscriptions in database");
  } else {
    subscriptions.forEach(subscription => {
      console.log(JSON.stringify(subscription) + "\n");
    });
  }
}

function isValidPhoneNumber(subscriptionId, country){
  let pn = new PhoneNumber(subscriptionId, country);
  return pn.isValid() && pn.isMobile();
}

function getPhoneNumberFormatted(subscriptionId, country){
  let pn = new PhoneNumber(subscriptionId, country);
  return pn.getCountryCode()+pn.getNumber('significant');
}

function removeSubscription() {
  const q = chalk.blue(
    "Type in phone number (example 46702136611) or email (example your.email@gmail.com) for the subscription you want to remove:\n"
  );
  prompt(q).then(subscriptionId => {
    if (subscriptionId) {
      var success = deleteSubscription(
        subscriptionId,
        subscriptionId.includes("@") ? "email" : "phone"
      );
      console.log(
        success
          ? "Subscription removed: " + subscriptionId
          : "Subscription missing: " + subscriptionId
      );
    } else {
      errorLog("Input is not valid...");
    }
  });
}

async function newSubscription() {
  const sub = chalk.blue(
    "Enter subscriptionId (either phone number example 46702136611 or email example your.email@gmail.com), country ('SE', 'NO', 'FI', 'DK') and language ('en', 'sv', 'no', 'da', 'fi'):\n"
  );
  prompt(sub).then(input => {
    let params = input.split(" ");
    let subscriptionId = params[0];
    let country = params[1];
    let language = params[2];

    if (
      params.length === 3 
      && (country && countries.find(element => element == country))
      && (language && languages.find(element => element == language))
      && (subscriptionId.includes("@") || isValidPhoneNumber(subscriptionId,country))
    ) {
      addSubscription(
        subscriptionId,
        subscriptionId.includes("@") ? "email" : "phone", language, country
      );
      console.log(
        "Please wait until you recives a 4 digit code on your email: " +
          subscriptionId
      );
      verifySubscription(
        subscriptionId,
        subscriptionId.includes("@") ? "email" : "phone"
      );
    } else {
      errorLog("Input ('" + input + "') is not valid...");
    }
  });
}

db.defaults({ subscriptions: [] }).write();

if (args.length > 3) {
  errorLog(`only one argument can be accepted`);
  usage();
}

switch (args[2]) {
  case "new":
    newSubscription();
    break;
  case "remove":
    removeSubscription();
    break;
  case "list":
    listSubscriptions();
    break;
  case "help":
    usage();
    break;
  default:
    errorLog("invalid command passed");
    usage();
    break;
}
