// Local event based client for alice
//
// Generates events for each G-On Alice Skill message
//

"use strict";

var mqtt = require('mqtt');
var MQTTPattern = require('mqtt-pattern');
var debug = require('debug')('sberLocal');
const packageConfig = require('../package.json');
const EventEmitter = require('events');

/**
 * @type {mqtt.MqttClient}
 */
var connection;
var count = 0;

/**
 * @typedef SberLocalOptions
 * @type {object}
 * @property {EventEmitter} eventBus - EventBus
 * @property {string} username - Username sber
 * @property {string} password - password sber
 * @property {string} clientId - client id
 * @property {boolean} debug - debug mode
 * @property {import('homebridge').Logger} log - logger
 *
 */

/**
 *
 * @param {SberLocalOptions} options
 */
function sberLocal(options) {

	connection = mqtt.connect({
		servers: [{
			protocol: "mqtts",
			host: "mqtt-partners.iot.sberdevices.ru",
			port: "8883",
		}],
		username: options.username,
		password: options.password,
		clientId: options.username,
	});
	options.log.log('Connecting to sber gate...');
	// connection.setMaxListeners(0);

	const sber_root_topic = 'sberdevices/v1/' + options.username;
	const stdown = sber_root_topic + '/down';

	connection.on('connect', function () {
		options.log.log('Connected to sber gate');
		connection.removeAllListeners('message'); // This hangs up everyone on the channel
		connection.subscribe("sberdevices/v1/__config"); // global config
    connection.subscribe(stdown + "/errors");
    connection.subscribe(stdown + "/commands");
    connection.subscribe(stdown + "/status_request");
    connection.subscribe(stdown + "/config_request");

    connection.on('message', function(topic, message) {
      var msg = {};

      try {
        msg = JSON.parse(message.toString());
      } catch(e) {
        options.log.debug("JSON message is empty or not valid");
        msg = {};
			}

			options.log.debug(topic, msg);

			switch (topic) {
				case "sberdevices/v1/__config":
					break;

				case stdown + "/errors":
					options.log.error(msg);
					break;

				case stdown + "/commands":
					options.eventBus.emit('commands', msg, function (err, res) {

					});
					break;

				case stdown + "/status_request":
					options.eventBus.emit('status_request', msg, function (err, res) {
						connection.publish(sber_root_topic + "/up/status", JSON.stringify(res));
					});
					break;

				case stdown + "/config_request":
					options.eventBus.emit('config_request', msg, function (err, res) {
						connection.publish(sber_root_topic + "/up/config", JSON.stringify(res));
					});
					break;

				default:
					options.log.log(">> unknown gate topic:", topic, "=>", msg);
					break;
			}

		});


  });

  connection.on('offline', function() {
    debug('offline');
  });

  connection.on('reconnect', function() {
    count++;
    debug('reconnect');
    if (count % 5 === 0) options.log("ERROR: No connection to homebridge.g-on.io. Retrying... please review the README and the Homebridge configuration.");
  });

  connection.on('error', function(err) {
    debug('error', err);
	});

	options.eventBus.on('hapReady', () => {
		options.eventBus.emit('config_request', {}, function (err, res) {
			connection.publish(sber_root_topic + "/up/config", JSON.stringify(res));
		});
	});
}

module.exports = sberLocal;