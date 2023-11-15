"use strict";

const SberClient = require('./lib/sberClient.js');
const HapClient = require('./lib/hapClient.js');
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

sberGate.prototype.didFinishLaunching = function() {
  options = {
    username: this.username,
    password: this.password,
    clientId: this.username,
    debug: this.debug,
    notifies: this.notifies,
    log: this.log,
    pin: this.pin,
  };

  var hap = new HapClient({
    pin: this.pin,
    debug: false,
  });

  hap.on('Ready', (acc) => {
    this.log("Hap Ready!");
    actions.sberDiscovery({}, (err, res) => {
      sber.eventBus.emit('sber.out.config', err, res)
    });
  });

  hap.on('hapEvent', (event) => {
    this.log.debug('>>hap event', event);
  });

  actions.sberInit(options, hap);

  var sber = new SberClient({
    username: this.username,
    password: this.password,
    clientId: this.username,
    log: this.log,
  });

  sber.eventBus.on('sber.in.config_request', (message) => {
    actions.sberDiscovery(message, (err, res) => {
      sber.eventBus.emit('sber.out.config', err, res);
    });
  });
  sber.eventBus.on('sber.in.status_request', (message) => {
    actions.sberStatus(message, (err, res) => {
      sber.eventBus.emit('sber.out.status', err, res);
    });
  });
  sber.eventBus.on('sber.in.commands', (message) => {
    actions.sberCommands(message, (err, res) => { });
  });
};