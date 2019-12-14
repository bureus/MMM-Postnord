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

Module.register("MMM-Postnord", {
  defaults: {
    locale: "en",
    refreshRateMin: "60"
  },
  getScripts: function() {
    return ["moment.js"];
  },

  getTranslations: function() {
    return {
      en: "translations/en.json",
      sv: "translations/sv.json",
      no: "translations/no.json",
      da: "translations/da.json",
      fi: "translations/fi.json"
    };
  },
  getStyles: function() {
    return [
      this.file("/css/postnord.css")
      //this.file("/css/fontawesome/all.min.css")
    ];
  },
  start: function() {
    Log.info("Starting module: " + this.name);
    this.updateDom();

    //Send config to node_helper
    Log.info("Send configs to node_helper..");
    this.sendSocketNotification("CONFIG", this.config);
  },
  getDom: function() {
    Log.info("getDom triggered");
    let wrapper = document.createElement("div");
    if (!this.loaded && !this.failure) {
      wrapper.className = "postnord-loading";
      var loading = document.createElement("div");
      loading.className = "loading";
      loading.innerHTML =
        '<img src="/modules/MMM-Postnord/images/logo.png"></img>';

      var span = document.createElement("div");
      span.className = "small dimmed";
      span.innerText = this.translate("CONNECTING");

      loading.appendChild(span);
      wrapper.appendChild(loading);
      return wrapper;
    } else if (this.loaded && this.failure && !this.packages) {
      wrapper.className = "postnord-error";
      var loading = document.createElement("div");
      loading.className = "loading";
      loading.innerHTML =
        '<img src="/modules/MMM-Postnord/images/logo.png"></img>';

      var span = document.createElement("div");
      span.className = "small dimmed";
      span.innerText = this.translate("MISSING_SUBSCRIPTION");

      loading.appendChild(span);
      wrapper.appendChild(loading);
      return wrapper;
    }
    wrapper.className = "vertical-package-list";
    this.packages.forEach(package => {
      let packageDiv = document.createElement("div");
      packageDiv.className = "row";
      let statusIcon = document.createElement("i");
      statusIcon.className = "block " + this.getStatusIcon(package.status);
      statusIcon.style = "width:35px;margin-right: 15px;";
      packageDiv.appendChild(statusIcon);
      let textDiv = document.createElement("div");
      let fromSpan = document.createElement("span");
      fromSpan.className = "small bright block";
      fromSpan.innerText = package.sender.name;
      textDiv.appendChild(fromSpan);
      textDiv.className = "package-text block";
      let statusHeaderSpan = document.createElement("span");
      statusHeaderSpan.className = "xsmall bright";
      statusHeaderSpan.innerText = package.statusText.header;
      textDiv.appendChild(statusHeaderSpan);
      if (package.estimatedTimeOfArrival) {
        let estimatedDelivery = document.createElement("span");
        estimatedDelivery.className = "xsmall light";
        let estimatedDateTime = new Date(package.estimatedTimeOfArrival);
        estimatedDelivery.innerText =
          this.translate("ESTIMATED_DELIVERY") +
          ": " +
          estimatedDateTime.toLocaleDateString();
        textDiv.appendChild(estimatedDelivery);
      }
      let statusLocationSpan = document.createElement("span");
      statusLocationSpan.className = "xsmall light";
      statusLocationSpan.innerText = package.statusText.location;
      textDiv.appendChild(statusLocationSpan);

      packageDiv.appendChild(textDiv);

      let weigthSpan = document.createElement("span");
      weigthSpan.className = "small light block";
      weigthSpan.style = "width: 30px;";
      weigthSpan.innerText = package.totalWeight
        ? package.totalWeight
        : this.translate("MISSING");

      packageDiv.appendChild(weigthSpan);
      wrapper.appendChild(packageDiv);
    });

    return wrapper;
  },
  socketNotificationReceived: function(notification, payload) {
    Log.info("socketNotificationReceived: " + notification);
    if (notification == "PACKAGES") {
      this.loaded = true;
      this.failure = undefined;
      this.packages = payload;
      this.updateDom();
    } else if (notification == "NOPACKAGES") {
      this.loaded = true;
      this.failure = undefined;
      this.packages = [];
      this.updateDom();
    } else if (notification == "MISSING_SUBSCRIPTION") {
      this.loaded = true;
      this.failure = true;
      this.packages = null;
      this.updateDom();
    }
  },
  notificationReceived: function(notification, payload, sender) {},
  getStatusIcon: function(status) {
    switch (status) {
      case "EN_ROUTE":
        return "fas fa-shipping-fast";
      case "OTHER":
        return "fas fa-box";
      case "AVAILABLE_FOR_DELIVERY":
        return "fas fa-box";
      case "DELIVERED":
        return "fas fa-check-circle";
      default:
        return "fas fa-mail-bulk";
    }
  }
});
