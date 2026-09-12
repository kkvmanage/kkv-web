import mongoose from 'mongoose';

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/kkv_gold_finance');
  const db = mongoose.connection.db;
  if (!db) {
    console.log('No DB connected');
    return;
  }
  const collections = await db.listCollections().toArray();
  console.log('Collections in kkv_gold_finance:', collections.map(c => c.name));

  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    console.log(`- ${col.name}: ${count} documents`);
    if (count > 0 && count <= 5) {
      const docs = await db.collection(col.name).find({}).limit(2).toArray();
      console.log(`  Sample doc from ${col.name}:`, JSON.stringify(docs[0]));
    }
  }

  // Also check if there are other databases in the local mongo instance!
  const client = mongoose.connection.getClient();
  const adminDb = client.db().admin();
  const dbs = await adminDb.listDatabases();
  console.log('All MongoDB databases on 127.0.0.1:27017:', dbs.databases.map((d: any) => d.name));

  for (const d of dbs.databases) {
    if (d.name.startsWith('kkv') && d.name !== 'kkv_gold_finance') {
      const otherDb = client.db(d.name);
      const cols = await otherDb.listCollections().toArray();
      console.log(`Database ${d.name} collections:`, cols.map((c: any) => c.name));
      for (const col of cols) {
        const cCount = await otherDb.collection(col.name).countDocuments();
        console.log(`  ${d.name}.${col.name}: ${cCount} docs`);
      }
    }
  }

  await mongoose.disconnect();
}

check();
