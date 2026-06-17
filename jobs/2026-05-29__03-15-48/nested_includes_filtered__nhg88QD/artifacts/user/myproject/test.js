const http = require('http');

const data = [
  {
    name: "TechCorp",
    departments: [
      {
        name: "Engineering",
        status: "active",
        employees: [
          { name: "Alice", role: "senior" },
          { name: "Bob", role: "junior" }
        ]
      },
      {
        name: "HR",
        status: "inactive",
        employees: [
          { name: "Charlie", role: "senior" }
        ]
      }
    ]
  },
  {
    name: "EmptyCorp",
    departments: []
  }
];

const req = http.request('http://localhost:3000/seed', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  console.log('Seed status:', res.statusCode);
  
  http.get('http://localhost:3000/companies/filtered', (res2) => {
    let body = '';
    res2.on('data', d => body += d);
    res2.on('end', () => {
      console.log('Filtered result:', JSON.stringify(JSON.parse(body), null, 2));
    });
  });
});

req.write(JSON.stringify(data));
req.end();
