const EventEmitter = require('events');
const mqtt = require('mqtt');

/**
 * @typedef SberLocalOptions
 * @type {object}
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
function SberClient(options) {

	/**
	 * @type {mqtt.MqttClient}
	 */
	let connection;
	let count = 0;

	/**
	 * @type {EventEmitter}
	 */
	this.eventBus = new EventEmitter();

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
	options.log('Connecting to sber gate...');
	// connection.setMaxListeners(0);

	const sber_root_topic = 'sberdevices/v1/' + options.username;
	const stdown = sber_root_topic + '/down';

	connection.on('connect', () => {
		options.log('Connected to sber gate');
		connection.removeAllListeners('message'); // This hangs up everyone on the channel
		connection.subscribe("sberdevices/v1/__config"); // global config
		connection.subscribe(stdown + "/errors");
		connection.subscribe(stdown + "/commands");
		connection.subscribe(stdown + "/status_request");
		connection.subscribe(stdown + "/config_request");

		connection.on('message', (topic, message) => {
			var msg = {};

			try {
				msg = JSON.parse(message.toString());
			} catch (e) {
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
					this.eventBus.emit('sber.in.commands', msg);
					break;

				case stdown + "/status_request":
					this.eventBus.emit('sber.in.status_request', msg);
					break;

				case stdown + "/config_request":
					this.eventBus.emit('sber.in.config_request', msg);
					break;

				default:
					options.log(">> unknown gate topic:", topic, "=>", msg);
					break;
			}
		});
	});

	this.eventBus.on('sber.out.config', (err, res) => {
		connection.publish(sber_root_topic + "/up/config", JSON.stringify(res));
	});
	this.eventBus.on('sber.out.status', (err, res) => {
		connection.publish(sber_root_topic + "/up/status", JSON.stringify(res));
	});

	connection.on('offline', function () {
		options.log.debug('offline');
	});

	connection.on('reconnect', function () {
		count++;
		options.log.debug('reconnect');
		if (count % 5 === 0) options.log.log("ERROR: No connection to homebridge.g-on.io. Retrying... please review the README and the Homebridge configuration.");
	});

	connection.on('error', function (err) {
		options.log.debug('error', err);
	});

}

module.exports = SberClient;