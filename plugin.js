"use strict";

var EventEmitter = require('events').EventEmitter;

var SberLocal = require('./lib/sberLocal.js');
var actions = require('./lib/actions.js');

const packageConfig = require('./package.json');

var options = {};

module.exports = function(homebridge) {
  homebridge.registerPlatform("homebridge-sber-gate", "Sber Gate", sberGate);
};

/**
 *
 * @param {import('homebridge').Logger} log
 * @param {import('homebridge').PlatformConfig} config
 * @param {import('homebridge').API} api
 */
function sberGate(log, config, api) {
  this.log = log;
  this.config = config;
  this.api = api;

  this.eventBus = new EventEmitter();
  this.pin = config['pin'] || "031-45-154";
  this.username = config['username'] || false;
  this.password = config['password'] || false;

  // Enable config based DEBUG logging enable
  this.debug = config['debug'] || false;

  if (!this.username || !this.password) {
    this.log.error("Missing username and password");
  }

  this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));

  this.log.info(
    '%s v%s, node %s, homebridge v%s',
    packageConfig.name, packageConfig.version, process.version, api.serverVersion
  );
}

sberGate.prototype = {
  accessories: function(callback) {
    this.log("accessories");
    callback();
  }
};

sberGate.prototype.didFinishLaunching = function() {
  options = {
    eventBus: this.eventBus,
    username: this.username,
    password: this.password,
    clientId: this.username,
    debug: this.debug,
    notifies: this.notifies,
    log: this.log,
    pin: this.pin,
  };

  actions.hapDiscovery(options);

  var sber = new SberLocal(options);

  this.eventBus.on('commands', actions.sberCommands.bind(this));
  this.eventBus.on('status_request', actions.sberStatus.bind(this));
  this.eventBus.on('config_request', actions.sberDiscovery.bind(this));
};

sberGate.prototype.configureAccessory = function(accessory) {
  this.log("configureAccessory");
  // callback();
};
