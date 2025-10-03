const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Product = require('./models/productModel');
const Client = require('./models/clientModel');
const Sale = require('./models/saleModel');
const Employee = require('./models/employeeModel');
const Expense = require('./models/expenseModel');

const importData = async () => {
  try {
    await connectDB();
    
    // Nettoyer la base de données
    await Promise.all([
      Product.deleteMany(),
      Client.deleteMany(),
      Sale.deleteMany(),
      Employee.deleteMany(),
      Expense.deleteMany()
    ]);

    // Créer des clients
    const clients = await Client.insertMany([
      {
        name: 'Marie Tremblay',
        email: 'marie.t@example.com',
        phone: '514-555-1234',
        address: '123 Rue Sainte-Catherine, Montréal'
      },
      {
        name: 'Jean Dupuis',
        email: 'jean.d@example.com',
        phone: '438-555-5678',
        address: '456 Boulevard René-Lévesque, Québec'
      }
    ]);

    // Créer des produits
    const products = await Product.insertMany([
      {
        name: 'Canapé en velours',
        description: 'Canapé 3 places couleur émeraude',
        price: 1299.99,
        stock: 10,
        category: 'Meubles',
        image: 'https://example.com/sofa.jpg'
      },
      {
        name: 'Table basse en chêne',
        description: 'Table basse rustique avec plateau en verre',
        price: 449.95,
        stock: 15,
        category: 'Meubles',
        image: 'https://example.com/table.jpg'
      }
    ]);

    // Créer des employés
    const employees = await Employee.insertMany([
      {
        name: 'Lucie Martin',
        email: 'lucie@etshd.com',
        phone: '514-555-9999',
        position: 'Gérante',
        salary: 65000,
        hireDate: new Date('2020-01-15')
      }
    ]);

    // Créer des dépenses
    await Expense.insertMany([
      {
        description: 'Achat de matériel de bureau',
        amount: 1200,
        category: 'supplies',
        date: new Date('2023-05-01'),
        paymentMethod: 'debit'
      }
    ]);

    // Créer des ventes
    await Sale.insertMany([
      {
        client: clients[0]._id,
        products: [{
          product: products[0]._id,
          quantity: 1,
          priceAtSale: products[0].price
        }],
        totalAmount: products[0].price * 1,
        paymentMethod: 'credit',
        status: 'completed'
      }
    ]);

    console.log('Données fictives insérées avec succès!'.green);
    process.exit();
  } catch (error) {
    console.error(`Erreur: ${error.message}`.red);
    process.exit(1);
  }
};

importData();
