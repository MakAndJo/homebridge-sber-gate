var HAPNodeJSClient = require('hap-node-client').HAPNodeJSClient;

/**
 * @typedef HapClientOptions
 * @type {object}
 * @property {boolean} pin - hap pin
 * @property {boolean} debug - debug mode
 * @property {import('homebridge').Logger} log - logger
 *
 */

class HapClient extends HAPNodeJSClient {
	/**
	 * HAP Discovery
	 * @param {HapClientOptions} options
	 */
	constructor(options) {
		super({
			pin: options.pin,
			debug: options.debug ?? false,
		});
	}
}

module.exports = HapClient;