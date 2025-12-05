const http = require('http');

const data = JSON.stringify({
    shares: ["a", "b"],
    sender: "0x123",
    to: "0x456",
    value: "0.1"
});

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/send-transaction',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
