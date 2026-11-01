import { PrismaClient } from '@prisma/client';

async function test() {
  const p1 = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres.oogxhcgebjxtaxjwjzdl:qaBbRFlHbMNFcIQF@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
      },
    },
  });

  try {
    console.log('Testing port 6543 (transaction pooler)...');
    await p1.$connect();
    console.log('✅ Port 6543 connected successfully!');
  } catch (e: any) {
    console.log('❌ Port 6543 failed:', e.message);
  } finally {
    await p1.$disconnect().catch(() => {});
  }

  const p2 = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres.oogxhcgebjxtaxjwjzdl:qaBbRFlHbMNFcIQF@aws-1-eu-central-1.pooler.supabase.com:5432/postgres',
      },
    },
  });

  try {
    console.log('\nTesting port 5432 (session pooler)...');
    await p2.$connect();
    console.log('✅ Port 5432 connected successfully!');
  } catch (e: any) {
    console.log('❌ Port 5432 failed:', e.message);
  } finally {
    await p2.$disconnect().catch(() => {});
  }
}

test();
