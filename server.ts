import Fastify from 'fastify'
import { Type } from '@sinclair/typebox'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const fastify = Fastify()

// --- UI หน้าบ้าน (เพิ่มปุ่มลบ Lab 4) ---
const html = `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <title>Inventory Management System</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; max-width: 950px; margin: 30px auto; padding: 20px; background: #eef2f3; }
        .container { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        h2 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        .form-group { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
        input { padding: 12px; border: 1px solid #ddd; border-radius: 6px; }
        button { background: #3498db; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; font-weight: bold; }
        button.delete-btn { background: #e74c3c; padding: 5px 10px; font-size: 12px; }
        button.delete-btn:hover { background: #c0392b; }
        table { width: 100%; border-collapse: collapse; margin-top: 25px; }
        th, td { padding: 15px; text-align: left; border-bottom: 1px solid #eee; }
        .low-stock { color: #e74c3c; background: #fdf2f2; }
    </style>
</head>
<body>
    <div class="container">
        <h2>📦 เพิ่มสินค้าใหม่ (Lab 2)</h2>
        <div class="form-group">
            <input type="text" id="name" placeholder="ชื่อสินค้า">
            <input type="text" id="sku" placeholder="รหัส SKU">
            <input type="text" id="zone" placeholder="โซน">
            <input type="number" id="quantity" placeholder="จำนวน" value="0">
        </div>
        <button onclick="addProduct()">➕ บันทึกสินค้า</button>

        <h2>📋 รายการสินค้า (Lab 1 & 4)</h2>
        <div id="productList">กำลังโหลด...</div>
    </div>

    <script>
        async function loadProducts() {
            const res = await fetch('/inventory');
            const data = await res.json();
            let table = '<table><tr><th>ชื่อ</th><th>SKU</th><th>จำนวน</th><th>จัดการ</th></tr>';
            data.forEach(p => {
                table += \`<tr class="\${p.quantity <= 10 ? 'low-stock' : ''}">
                    <td>\${p.name}</td>
                    <td>\${p.sku}</td>
                    <td>\${p.quantity}</td>
                    <td><button class="delete-btn" onclick="deleteProduct('\${p.id}')">🗑️ ลบ (Lab 4)</button></td>
                </tr>\`;
            });
            table += '</table>';
            document.getElementById('productList').innerHTML = table;
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
            if (res.ok) { loadProducts(); } else { alert('เกิดข้อผิดพลาด!'); }
        }

        // --- ฟังก์ชันสำหรับ Lab 4 (ลบสินค้า) ---
        async function deleteProduct(id) {
            const res = await fetch('/inventory/' + id, { method: 'DELETE' });
            const result = await res.json();
            if (res.ok) {
                alert(result.message);
                loadProducts();
            } else {
                alert('ลบไม่ได้: ' + result.message); // จะแจ้งเตือนถ้าสต็อก > 0
            }
        }
        loadProducts();
    </script>
</body>
</html>
`;

const ProductSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  sku: Type.String({ minLength: 1 }),
  zone: Type.String({ minLength: 1 }),
  quantity: Type.Number({ minimum: 0, default: 0 })
})

// --- API Routes ---

fastify.get('/', async (n, reply) => reply.type('text/html').send(html))

fastify.get('/inventory', async (req: any) => {
  return await prisma.product.findMany({ orderBy: { name: 'asc' } })
})

fastify.post('/inventory', { schema: { body: ProductSchema } }, async (req: any, reply) => {
  try {
    return await prisma.product.create({ data: req.body })
  } catch (e) { return reply.code(400).send({ message: "SKU ซ้ำ" }) }
})

// --- Lab 4: DELETE ---
fastify.delete('/inventory/:id', async (req: any, reply) => {
  const { id } = req.params
  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) return reply.code(404).send({ message: "ไม่พบสินค้า" })
  
  // เงื่อนไขตามโจทย์ Lab 4: ถ้าของเหลือ (quantity > 0) ห้ามลบ
  if (product.quantity > 0) {
    return reply.code(400).send({ message: "ยังมีของในสต็อก ห้ามลบ!" })
  }

  await prisma.product.delete({ where: { id } })
  return { message: "ลบสินค้าสำเร็จแล้ว" }
})

fastify.listen({ port: 3000, host: '0.0.0.0' }, (err) => {
  if (err) throw err
  console.log('🚀 Server is running at http://localhost:3000')
})