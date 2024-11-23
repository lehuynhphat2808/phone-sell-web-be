const swaggerAutogen = require('swagger-autogen')();

const doc = {
  info: {
    title: 'Seafood API 2',
    description: 'API for seafood e-commerce platform',
  },
  host: 'nha-trang-sea-food-rcfdmqtop-ps-projects-6fd1b1d9.vercel.app',
  schemes: ['http', 'https'],
};

const outputFile = './swagger-output.json';
const endpointsFiles = ['./app.js'];

swaggerAutogen(outputFile, endpointsFiles, doc);
