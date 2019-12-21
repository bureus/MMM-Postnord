/* MMM-Postnord.js
 *
 * Magic Mirror Module - Automatically track and trace PostNords letters, parcels and pallets with your phone number or email
 *
 * Magic Mirror
 * Module: MMM-Postnord
 *
 * Magic Mirror By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 *
 * Module MMM-Postnord by Bure Råman Vinnå
 *
 */

const NodeHelper = require("node_helper");
const request = require("request-promise");
const format = require("string-format");
var _ = require("lodash");
var merge = require("lodash.merge");
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const adapter = new FileSync("./modules/MMM-Postnord/db.json");
const db = low(adapter);
var debugMe = false;

var config = {
  apiKey: "591aa0cdb8cf85d41fede9b027b1e1c7",
  baseUrl: "https://appi.postnord.com/rest",
  headers: {
    "User-Agent": "PostNord/6.5.2-Android",
    Connection: "Keep-Alive",
    Host: "appi.postnord.com",
    "Accept-Encoding": "gzip"
  }
};

module.exports = NodeHelper.create({
  start: function() {
    const self = this;
    log("Starting helper: " + self.name);
    self.started = false;
    format.extend(String.prototype, {});
    debug("Getting subscriptions...");
    self.subscriptions = db.get("subscriptions").value();
    debug(
      "Number of subscriptions: {0}".format(
        db
          .get("subscriptions")
          .size()
          .value()
      )
    );
  },
  scheduleUpdate: function() {
    const self = this;
    self.updatetimer = setInterval(function() {
      self.getSubscriptionsPackageInfo();
    }, self.config.refreshRate);
  },
  reclaimHash: async function(subscription) {
    return new Promise(resolve => {
      debug("reclaimHash: request init with hash: " + subscription.hash);
      let options = {
        method: "GET",
        uri: "{0}/customer/v1/identity/reclaim/{1}?deviceid={2}&hash={3}&apikey={4}".format(
          this.config.baseUrl,
          subscription.subscriptionId,
          subscription.deviceId,
          subscription.hash,
          this.config.apiKey
        ),
        headers: this.config.headers,
        json: true
      };
      request(options)
        .then(function(response) {
          debug("reclaimHash: {0}".format(JSON.stringify(response)));
          resolve(response);
        })
        .catch(function(error) {
          log("reclaimHash failed: {0}".format(JSON.stringify(error)));
        });
    });
  },
  getUserProfile: async function(subscription) {
    return new Promise(resolve => {
      debug("getUserProfile: request init");
      let options = {
        method: "GET",
        uri: "{0}/customer/v1/identity/accountinfo/{1}?deviceid={2}&hash={3}&apikey={4}".format(
          this.config.baseUrl,
          subscription.subscriptionId,
          subscription.deviceId,
          subscription.hash,
          this.config.apiKey
        ),
        headers: this.config.headers,
        json: true
      };
      request(options)
        .then(function(response) {
          debug("getUserProfile: {0}".format(JSON.stringify(response)));
          resolve(response);
        })
        .catch(function(error) {
          log("getUserProfile failed: {0}".format(JSON.stringify(error)));
          resolve(null);
        });
    });
  },
  getShipments: async function(subscription) {
    return new Promise(resolve => {
      debug("getShipments: request init");
      let options = {
        method: "GET",
        uri: "{0}/customer/v1/identity/recipients/{1}/shipments?deviceid={2}&hash={3}&apikey={4}".format(
          this.config.baseUrl,
          subscription.subscriptionId,
          subscription.deviceId,
          subscription.hash,
          this.config.apiKey
        ),
        headers: this.config.headers,
        json: true
      };
      request(options)
        .then(function(response) {
          debug("getShipments: {0}".format(JSON.stringify(response)));
          resolve(response);
        })
        .catch(function(error) {
          log("getShipments failed: {0}".format(JSON.stringify(error)));
          resolve(null);
        });
    });
  },
  getTrackAndTraceShipment: async function(id) {
    return new Promise(resolve => {
      debug("getTrackAndTraceShipment: request init");
      let options = {
        method: "GET",
        uri: "{0}/shipment/v4/trackandtrace/findByIdentifier.json?id={1}&locale={2}&apikey={3}".format(
          this.config.baseUrl,
          id,
          this.config.locale,
          this.config.apiKey
        ),
        headers: this.config.headers,
        json: true
      };
      request(options)
        .then(function(response) {
          debug(
            "getTrackAndTraceShipment({0}): {1}".format(
              id,
              JSON.stringify(response)
            )
          );
          resolve(response);
        })
        .catch(function(error) {
          log(
            "getTrackAndTraceShipment failed: {0}:{1}".format(
              response.statusCode,
              JSON.stringify(error)
            )
          );
          resolve(null);
        });
    });
  },
  getNewHash: async function(subscription) {
    const self = this;
    let reclaimedHash = await self.reclaimHash(subscription);
    if (reclaimedHash.hash) {
      subscription.hash = reclaimedHash.hash;
      subscription.reclaimedHash = new Date(Date.now()).toLocaleDateString();
      db.get("subscriptions")
        .find({
          subscriptionId: subscription.subscriptionId,
          type: subscription.type
        })
        .assign(subscription)
        .write();
    } else {
      log(
        "getNewHash: failed to retrive new hash for subscription: {0}".format(
          subscription.subscriptionId
        )
      );
    }
    return subscription;
  },
  getSubscriptionsPackageInfo: async function() {
    const self = this;
    clearInterval(self.updatetimer);
    self.subscriptions = db.get("subscriptions").value();
    if (self.subscriptions.length > 0) {
      let packages = [];
      for (const subscription of self.subscriptions) {
        let userInfo = await self.getUserProfile(subscription);
        if (
          !userInfo ||
          !userInfo.hashValidInSeconds ||
          userInfo.hashValidInSeconds < 10000
        ) {
          subscription = self.getNewHash(subscription);
        }

        let parcels = await self.getShipments(subscription);
        if (parcels.shipments.length > 0) {
          for (const shipment of parcels.shipments) {
            if (shipment.direction == "incoming") {
              let parcelInfo = await self.getTrackAndTraceShipment(
                shipment.shipmentId
              );
              let parcelDetailedInfo =
                parcelInfo.TrackingInformationResponse.shipments[0];
              let shipmentInfo = {
                id: shipment.shipmentId,
                direction: shipment.direction,
                deliveryDate: parcelDetailedInfo.deliveryDate,
                sender: {
                  name: parcelDetailedInfo.consignor.name
                },
                estimatedTimeOfArrival:
                  parcelDetailedInfo.estimatedTimeOfArrival,
                status: parcelDetailedInfo.status,
                statusText: {
                  header: parcelDetailedInfo.statusText.header,
                  body: parcelDetailedInfo.statusText.body,
                  location:
                    parcelDetailedInfo.items[0].events[
                      parcelDetailedInfo.items[0].events.length - 1
                    ].location.displayName
                },
                totalWeight: parcelDetailedInfo.totalWeight
                  ? "{0}{1}".format(
                      parcelDetailedInfo.totalWeight
                        ? parcelDetailedInfo.totalWeight.value
                        : parcelDetailedInfo.assessedWeight.value,
                      parcelDetailedInfo.totalWeight
                        ? parcelDetailedInfo.totalWeight.unit
                        : parcelDetailedInfo.assessedWeight.unit
                    )
                  : null
              };
              if (
                shipmentInfo.status == "DELIVERED" &&
                this.config.deliveredPackagesCooldown
              ) {
                let deliveryDate = new Date(shipmentInfo.deliveryDate);
                let now = new Date(Date.now());
                let hrsSinceDelivery = (now - deliveryDate) / 1000 / 60 / 60;
                if (hrsSinceDelivery < this.config.deliveredPackagesCooldown) {
                  packages.push(shipmentInfo);
                }
              } else {
                packages.push(shipmentInfo);
              }
            }
          }
        }
      }
      let toBeRetruned = _.uniqBy(packages, "id");
      self.sendSocketNotification("PACKAGES", toBeRetruned);
    } else {
      self.sendSocketNotification("NOPACKAGES");
    }
    self.scheduleUpdate();
  },
  socketNotificationReceived: async function(notification, payload) {
    const self = this;
    log("socketNotificationReceived");
    if (notification === "CONFIG" && payload.refreshRateMin != "") {
      if (self.subscriptions) {
        self.started = true;
        self.config = merge(config, payload);
        self.config.refreshRate = self.config.refreshRateMin * 60 * 1000;
        //debugMe = self.config.debug;
        self.getSubscriptionsPackageInfo();
        if (!self.updatetimer) {
          self.scheduleUpdate();
        }
        debug("Subscription found data retrived and sent to front end.");
      } else {
        self.sendSocketNotification("MISSING_SUBSCRIPTION");
        debug("Missing subscriptions");
      }
    } else {
      log("Missing configurations please update config.js");
    }
  }
});

function logStart() {
  return new Date(Date.now()).toLocaleTimeString() + " MMM-Postnord: ";
}

function log(msg) {
  console.log(logStart() + msg);
}

function debug(msg) {
  if (debugMe) log(msg);
}
