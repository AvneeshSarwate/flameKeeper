const pino = require('pino');

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
        level(lable, _) {
            return { level: lable }
        }
    },
    prettyPrint: {
        translateTime: true,
        ignore: 'pid,hostname,origin',
        messageFormat: `[{origin}] {msg}`
    }
});

const getLogger = origin => {
    return logger.child({origin: origin});
};

exports.getLogger = getLogger;
