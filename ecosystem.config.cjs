module.exports = {
    apps: [
        {
            name: 'SAIL-Technical-App', // Replace with your application's name
            script: 'dist/index.js', // Replace with the entry point script of your application
            instances: 1, // The number of instances you want to run (usually set to 1 for single instance)
            autorestart: true, // Automatically restart the application if it crashes
            watch: false, // Set to true if you want pm2 to watch for file changes and automatically reload
            // max_memory_restart: '1G', // Restart the application if memory usage exceeds this limit
        },
    ],
};