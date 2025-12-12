// server.js
require('dotenv').config();
const http = require('http');
const os = require('os');
const cluster = require('cluster');
const app = require('./app');
const dbPool = require('./src/db/dbConnection'); // PostgreSQL Pool

const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';
const numCPUs = os.cpus().length;

if (isProd && cluster.isMaster) {
    console.log(`🟢 Master process ${process.pid} running`);
    console.log(`🚀 Starting ${numCPUs} worker processes...`);

    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    // Restart worker if it crashes
    cluster.on('exit', (worker, code, signal) => {
        console.error(`❌ Worker ${worker.process.pid} died. Restarting...`);
        cluster.fork();
    });
} else {
    // ✅ First test DB connection before starting server
    dbPool.connect()
        .then((client) => {
            console.log('🟢 Database connected successfully.');
            client.release(); // Release the test client back to pool

            const server = http.createServer(app);

            server.listen(PORT, () => {
                console.log(
                    `✅ Server running on port ${PORT} | PID: ${process.pid} | Mode: ${isProd ? 'Production' : 'Development'}`
                );
            });

            // Graceful shutdown
            const shutdown = (signal) => {
                console.log(`\n🔻 ${signal} received. Closing server...`);
                server.close(async () => {
                    console.log('🛑 Server closed gracefully.');

                    try {
                        await dbPool.end();
                        console.log('🔌 Database pool closed.');
                    } catch (err) {
                        console.error('❌ Error closing DB pool:', err);
                    }

                    process.exit(0);
                });

                // Force exit after 10s if not closed
                setTimeout(() => {
                    console.error('⚠️ Forced shutdown.');
                    process.exit(1);
                }, 10000);
            };

            process.on('SIGINT', () => shutdown('SIGINT'));
            process.on('SIGTERM', () => shutdown('SIGTERM'));

            // Handle uncaught exceptions
            process.on('uncaughtException', (err) => {
                console.error('💥 Uncaught Exception:', err);
                shutdown('UncaughtException');
            });

            // Handle unhandled promise rejections
            process.on('unhandledRejection', (reason, promise) => {
                console.error('💥 Unhandled Rejection:', reason);
                shutdown('UnhandledRejection');
            });
        })
        .catch((err) => {
            console.error('❌ Database connection failed:', err);
            process.exit(1);
        });
}
