var HAPNodeJSClient = require('hap-node-client').HAPNodeJSClient;
var Homebridges = require('./mapping/Homebridges.js').Homebridges;

var homebridge;
var opt;

module.exports = {
	sberDiscovery: sberDiscovery,
	sberStatus: sberStatus,
	sberCommands: sberCommands,
  hapDiscovery: hapDiscovery
};

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
 * HAP Discovery
 * @param {SberLocalOptions} options
 */
function hapDiscovery(options) {
	opt = options;
	homebridge = new HAPNodeJSClient({
		pin: options.pin,
		debug: false ?? options.debug,
	});
  homebridge.on('Ready', function(accessories) {
		options.log.debug('>>hap ready', 1);
		options.eventBus.emit('hapReady');
  });
  homebridge.on('hapEvent', function(event) {
    options.log.debug('>>hap event', 3);
		options.eventBus.emit('hapEvent', event);
  });
}

const hbdict = {
	'devices.types.switch': { 'id': 'model_switch', 'manufacturer': 'TJMC', 'model': 'Switch', 'category': 'relay', 'features': ['on_off'] },
	'relay': { 'id': 'model_relay', 'manufacturer': 'TJMC', 'model': 'Relay', 'category': 'relay', 'features': ['online', 'on_off'] },
	'ipc': { 'id': 'model_ipc', 'manufacturer': 'TJMC', 'model': 'IPC', 'category': 'ipc', 'features': ['online', 'on_off'] }
};

function hbToSberDevice(hbDevice) {
	return ({
		id: hbDevice.id,
		name: hbDevice.name,
		default_name: hbDevice.name,
		model: hbdict[hbDevice['type']] || {},
		model_id: ""
	});
}

/**
 * Sber Devices Discovery (init/period)
 * @param {*} message
 * @param {Function} callback
 */
function sberDiscovery(message, callback) {
	homebridge.HAPaccessories(function (endPoints) {
		opt.log.log("sberDiscovery");
		var response;
		var hbDevices = new Homebridges(endPoints, this);
		response = hbDevices.getDevicesAndCapabilities(message);
		opt.log.debug("Discovery hbResDev", JSON.stringify(response, null, 4));
		// debug("RESPONSE", JSON.stringify(response));
		if (response && response.payload.devices.length < 1) {
			opt.log.log("ERROR: HAP Discovery failed, please review config");
		} else {
			opt.log.log("sberDiscovery - returned %s devices", response.payload.devices.length);
		}

		const devices = response['payload']['devices'].map(hbToSberDevice);
		opt.log.debug("Discovery Response", JSON.stringify(devices, null, 4));
		callback(null, { devices: devices });
	}.bind(this));
}

/**
 * Sber Devices Status request
 * @param {*} message
 * @param {Function} callback
 */
function sberStatus(message, callback) {
  var response = {
    devices : {}
  };

	try {
    if (message.devices.length == 0) {
      throw new Error('device array is empty');
		}
		homebridge.HAPaccessories(async function (endPoints) {
			var hbDevices = new Homebridges(endPoints, this);
			message.devices = message.devices.filter(Boolean);
			var devicesHBName = hbDevices.getDevicesHBName(message.devices, opt.log);
			var currentEndpoint = endPoints.find(function (endpoint) {
				// Compare endpoint homebridge name and current hb_name
				return devicesHBName.includes(endpoint.instance.name)
			});

			opt.log.debug("Status end", JSON.stringify(currentEndpoint, null, 4));

			for (var i = 0; i < message.devices.length; i++) {
        var device_id = message.devices[i];
        var dev_status = hbDevices.checkThatDeviceExists(device_id);

        if (dev_status.error_code) {
          // debug(dev_status.error_message, device_data);
					Object.assign(response.devices, {
						[device_id]: {
							id: device_id,
							error_code: dev_status.error_code,
							error_message: dev_status.error_message
						}
					});
          continue;
				}

				let status = await dev_status.service.getDeviceState(homebridge, currentEndpoint.instance.deviceID);

				Object.assign(response.devices, {
					[device_id]: status
				});
			}

			opt.log.debug("Status Response", JSON.stringify(response, null, 4));

			callback(null, response);
		}.bind(this));

	} catch(e) {
    // probably JSON does not have those fields.
    opt.log.error("error with action JSON data", e.message);
    callback(e, {
      "payload": {
        "error_code": 400, // bad request data
        "error_message": e.message
      }
    });
  }


}

/**
 * Sber Devices Commands execute
 * @param {*} message
 * @param {Function} callback
 */
function sberCommands(message, callback) { }
