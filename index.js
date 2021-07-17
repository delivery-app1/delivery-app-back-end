const express = require('express');
const app = express();
const http = require('http');
const PORT = process.env.PORT || 5000;
const cors = require('cors');
const server = http.createServer(app);

const staffRoom = 'staff';
const { v4: uuidv4 } = require('uuid');

const socketIo = require('socket.io');


const io = socketIo(server, {
  cors: {
    origin: '*',
  },
});




const queue = {
  ordars: [],
  staff: [],
};
app.use(cors());

const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/ordars', { useNewUrlParser: true, useUnifiedTopology: true });

const orderSchema = new mongoose.Schema({
  customerName: String,
  notes: String,
  size: String,
  coffee: Array,
  branch: String,
  socketId : String,
});

const orderModel = mongoose.model('ordars', orderSchema);

class Order {
  constructor(ordars) {
    this.notes = ordars.notes;
    this.size = ordars.size;
    this.coffee = ordars.coffee;
    this.branch = ordars.branch;
    this.socketId = ordars.customerId 
  }
}

app.get('/admin', getOrderHandler);
app.delete('/deletOrder/:id', deleteOrderHandler);

function getOrderHandler(req, res) {
  const dataOrders = queue.data.map(ele => {
    return new Order(ele);
  })

  res.send(dataOrders);
  console.log(dataOrders);
}

function deleteOrderHandler(req, res) {
  const id = req.params.id;
  orderModel.remove({ _id: id }, (error, data) => {

    orderModel.find({}, (error, data2) => {
      queue.ordars = data2;
      res.send(data2)
    })
  })
}


io.on('connection', (socket) => {
  // console.log('clie.nt connected', socket.id);
  //2a
  socket.on('join', (payload) => {
    // socket.join will put the socket in a private room
    const staff = { name: payload.name, id: socket.id };
    queue.staff.push(staff);
    socket.join(staffRoom);
    socket.to(staffRoom).emit('onlineStaff', staff);
  });
  socket.on('delete', (id) => {

    orderModel.remove({ _id: id }, (error, data) => {

      orderModel.find({}, (error, data2) => {
        queue.ordars = data2;
      socket.in(staffRoom).emit('newTicket', queue.ordars);
      })
    })

    
  })
  socket.on('createTicket', async (payload) => {
    // 2
    // console.log('ticket', payload);
    
    const ticketData = { ...payload, id: uuidv4(), socketId: socket.id };
    const newOrders = new orderModel(ticketData);

    newOrders.save().then((result) => {
      queue.ordars.push(result);
      socket.in(staffRoom).emit('newTicket', queue.ordars);
    });

    // console.log('',newOrders)


  });

  socket.on('claim', (payload) => {
    // console.log('tic', queue.ordars);
    console.log('t', payload);

    socket.to(payload.customerId).emit('claimed', { name: payload.name, done:payload.done, price:payload.price  });
    console.log('id', payload.customerId);
    queue.ordars = queue.ordars.filter((t) => t.id !== payload.id);
  });
  socket.on('getAll', () => {
    queue.staff.forEach((person) => {
      socket.emit('onlineStaff', { name: person.name, id: person.id });
      console.log('hi', person.name);
    });
    // queue.ordars.forEach((ticket) => {
    // });
    socket.emit('newTicket', queue.ordars);
  });
  socket.on('disconnect', () => {
    socket.to(staffRoom).emit('offlineStaff', { id: socket.id });
    queue.staff = queue.staff.filter((s) => s.id !== socket.id);
  });
});
server.listen(PORT, () => {
  console.log(`Listening on PORT ${PORT}`);
});