import Fastify from 'fastify'
import { Type } from '@sinclair/typebox'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const fastify = Fastify({ logger: true })

// --- UI หน้าบ้าน (HTML + JavaScript) ---
const html = `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <title>Inventory System</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; max-width: 900px; margin: 20px auto; padding: 20px; background: #f4f7f6; }
        .card { background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .form-group { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; }
        input { padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
        button { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; }
        button.del { background: #e74c3c; padding: 5px 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
        .low { color: red; font-weight: bold; }
    </style>
</head>
<body>
    <div class="card">
        <h2>📦 เพิ่มสินค้า (Lab 2)</h2>
        <div class="form-group">
            <input type="text" id="name" placeholder="ชื่อสินค้า">
            <input type="text" id="sku" placeholder="SKU">
            <input type="text" id="zone" placeholder="โซน">
            <input type="number" id="quantity" placeholder="จำนวน" value="0">
        </div>
        <button onclick="addProduct()">บันทึก</button>
    </div>

    <div class="card">
        <h2>📋 รายการสินค้า (Lab 1 & 4)</h2>
        <button onclick="loadProducts(true)" style="background:#f39c12">ดูเฉพาะสต็อกต่ำ (<=10)</button>
        <button onclick="loadProducts(false)" style="background:#95a5a6">ดูทั้งหมด</button>
        <div id="list">กำลังโหลด...</div>
    </div>

    <script>
        async function loadProducts(low = false) {
            const res = await fetch(low ? '/inventory?low_stock=true' : '/inventory');
            const data = await res.json();
            let h = '<table><tr><th>ชื่อ</th><th>SKU</th><th>จำนวน</th><th>จัดการ</th></tr>';
            data.forEach(p => {
                h += \`<tr class="\${p.quantity <= 10 ? 'low' : ''}">
                    <td>\${p.name}</td><td>\${p.sku}</td><td>\${p.quantity}</td>
                    <td><button class="del" onclick="del('\${p.id}')">ลบ</button></td></tr>\`;
            });
            document.getElementById('list').innerHTML = h + '</table>';
        }

        async function addProduct() {
            const body = {
                name: document.getElementById('name').value,
                sku: document.getElementById('sku').value,
                zone: document.getElementById('zone').value,
                quantity: Number(document.getElementById('quantity').value)
            };
            const res = await fetch('/inventory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (res.ok) { loadProducts(); } else { alert('ผิดพลาด!'); }
        }

        async function del(id) {
            const res = await fetch('/inventory/' + id, { method: 'DELETE' });
            const result = await res.json();
            if (res.ok) { alert(result.message); loadProducts(); }
            else { alert('ลบไม่ได้: ' + result.message); }
        }
        loadProducts();
    </script>
</body>
</html>
`;

// --- Validation Schema ---
const ProductSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  sku: Type.String({ minLength: 1 }),
  zone: Type.String({ minLength: 1 }),
  quantity: Type.Number({ minimum: 0, default: 0 })
})

// --- Routes ---
fastify.get('/', async (n, reply) => reply.type('text/html').send(html))

fastify.get('/inventory', async (req: any) => {
  const { low_stock } = req.query
  return await prisma.product.findMany({
    where: low_stock === 'true' ? { quantity: { lte: 10 } } : {},
    orderBy: { name: 'asc' }
  })
})

fastify.post('/inventory', { schema: { body: ProductSchema } }, async (req: any, reply) => {
  try {
    return await prisma.product.create({ data: req.body })
  } catch (e) { return reply.code(400).send({ message: "SKU ซ้ำ" }) }
})

fastify.delete('/inventory/:id', async (req: any, reply) => {
  const { id } = req.params
  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) return reply.code(404).send({ message: "ไม่พบสินค้า" })
  if (product.quantity > 0) return reply.code(400).send({ message: "ยังมีของเหลือห้ามลบ" })
  await prisma.product.delete({ where: { id } })
  return { message: "ลบสำเร็จ" }
})

// --- Server Startup (สำคัญสำหรับ Vercel) ---
const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    await fastify.listen({ port: port, host: '0.0.0.0' });
  } catch (err) {
    process.exit(1);
  }
};
start();