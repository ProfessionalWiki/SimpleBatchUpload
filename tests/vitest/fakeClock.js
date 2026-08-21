/**
 * A clock whose only way forward is a sleep, so backoff arithmetic can be
 * asserted exactly and no test waits for real time.
 *
 * @return {Object}
 */
function createFakeClock() {
	let time = 0;

	return {
		now: () => time,
		sleep: ( ms ) => {
			time += ms;
			return Promise.resolve();
		},
		advance: ( ms ) => {
			time += ms;
		}
	};
}

module.exports = { createFakeClock: createFakeClock };
