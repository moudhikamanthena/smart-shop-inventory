const STORAGE_PRODUCTS = "smartShopProducts";
const STORAGE_SALES = "smartShopSales";
let products = JSON.parse(localStorage.getItem(STORAGE_PRODUCTS) || "[]");
let sales = JSON.parse(localStorage.getItem(STORAGE_SALES) || "[]");
let cart = [];
let editingId = null;

const $ = id => document.getElementById(id);
const money = value => "₹" + Number(value).toFixed(2);
const saveData = () => {
  localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(products));
  localStorage.setItem(STORAGE_SALES, JSON.stringify(sales));
};

function render() {
  const search = $("searchInput").value.trim().toLowerCase();
  const filtered = products.filter(p => p.id.toLowerCase().includes(search) || p.name.toLowerCase().includes(search));
  $("productTable").innerHTML = filtered.map(p => `
    <tr>
      <td>${escapeHTML(p.id)}</td><td>${escapeHTML(p.name)}</td>
      <td>${money(p.price)}</td><td>${p.quantity}</td>
      <td><button class="edit" data-edit="${escapeHTML(p.id)}">Edit</button>
      <button class="delete" data-delete="${escapeHTML(p.id)}">Delete</button></td>
    </tr>`).join("");
  $("emptyProducts").style.display = filtered.length ? "none" : "block";
  $("totalProducts").textContent = products.length;
  $("totalStock").textContent = products.reduce((sum,p)=>sum+p.quantity,0);
  $("lowStockCount").textContent = products.filter(p=>p.quantity<=5).length;
  const revenue = sales.reduce((sum,s)=>sum+s.total,0);
  $("totalSales").textContent = money(revenue);
  $("billCount").textContent = new Set(sales.map(s=>s.billId)).size;
  $("itemsSold").textContent = sales.reduce((sum,s)=>sum+s.quantity,0);
  $("revenue").textContent = money(revenue);
  $("lowStockList").innerHTML = products.filter(p=>p.quantity<=5).map(p=>`<li>${escapeHTML(p.name)} — ${p.quantity} left</li>`).join("") || "<li>No low-stock products.</li>";
  $("billProduct").innerHTML = '<option value="">Select a product</option>' + products.filter(p=>p.quantity>0).map(p=>`<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} (${p.quantity} available)</option>`).join("");
  renderCart();
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}

$("productForm").addEventListener("submit", event => {
  event.preventDefault();
  const id = $("productId").value.trim();
  const name = $("productName").value.trim();
  const price = Number($("productPrice").value);
  const quantity = Number($("productQuantity").value);
  if (!id || !name || !Number.isFinite(price) || price<=0 || !Number.isInteger(quantity) || quantity<0) {
    $("productMessage").textContent = "Enter valid product details."; return;
  }
  if (editingId === null && products.some(p=>p.id.toLowerCase()===id.toLowerCase())) {
    $("productMessage").textContent = "This Product ID already exists."; return;
  }
  if (editingId !== null) {
    const p = products.find(p=>p.id===editingId);
    if (id !== editingId && products.some(p=>p.id.toLowerCase()===id.toLowerCase())) {
      $("productMessage").textContent = "This Product ID already exists."; return;
    }
    Object.assign(p,{id,name,price,quantity});
    editingId = null;
    $("saveProduct").textContent = "Add Product";
    $("cancelEdit").classList.add("hidden");
    $("productMessage").textContent = "Product updated successfully.";
  } else {
    products.push({id,name,price,quantity});
    $("productMessage").textContent = "Product added successfully.";
  }
  saveData(); $("productForm").reset(); render();
});

$("productTable").addEventListener("click", event => {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;
  if (editId) {
    const p = products.find(p=>p.id===editId);
    $("productId").value=p.id; $("productName").value=p.name;
    $("productPrice").value=p.price; $("productQuantity").value=p.quantity;
    editingId=p.id; $("saveProduct").textContent="Save Changes";
    $("cancelEdit").classList.remove("hidden"); $("productId").focus();
  }
  if (deleteId && confirm("Delete this product?")) {
    products=products.filter(p=>p.id!==deleteId);
    cart=cart.filter(item=>item.productId!==deleteId);
    saveData(); render(); $("productMessage").textContent="Product deleted.";
  }
});

$("cancelEdit").addEventListener("click",()=>{
  editingId=null; $("productForm").reset(); $("saveProduct").textContent="Add Product";
  $("cancelEdit").classList.add("hidden"); $("productMessage").textContent="";
});
$("searchInput").addEventListener("input",render);

$("billForm").addEventListener("submit",event=>{
  event.preventDefault();
  const id=$("billProduct").value, quantity=Number($("billQuantity").value);
  const p=products.find(p=>p.id===id);
  if(!p || !Number.isInteger(quantity) || quantity<1){$("billMessage").textContent="Choose a product and valid quantity.";return;}
  const already=cart.filter(i=>i.productId===id).reduce((s,i)=>s+i.quantity,0);
  if(quantity+already>p.quantity){$("billMessage").textContent="Not enough stock for this quantity.";return;}
  const existing=cart.find(i=>i.productId===id);
  if(existing) existing.quantity+=quantity;
  else cart.push({productId:id,name:p.name,price:p.price,quantity});
  $("billMessage").textContent="Product added to bill."; $("billQuantity").value=1; renderCart();
});

function renderCart(){
  $("billItems").innerHTML=cart.map(item=>`<div class="bill-line"><span>${escapeHTML(item.name)} × ${item.quantity}</span><strong>${money(item.price*item.quantity)}</strong></div>`).join("") || '<p class="muted">No products added to this bill.</p>';
  const total=cart.reduce((sum,item)=>sum+item.price*item.quantity,0);
  $("billTotal").textContent=money(total); $("completeBill").disabled=cart.length===0;
}
$("clearBill").addEventListener("click",()=>{cart=[];renderCart();$("billMessage").textContent="Bill cleared.";});

$("completeBill").addEventListener("click",()=>{
  if(!cart.length)return;
  for(const item of cart){
    const p=products.find(p=>p.id===item.productId);
    if(!p || p.quantity<item.quantity){$("billMessage").textContent="Stock changed. Please review the bill.";return;}
  }
  const billId="B"+Date.now();
  const date=new Date().toLocaleString();
  cart.forEach(item=>{
    const p=products.find(p=>p.id===item.productId);
    p.quantity-=item.quantity;
    sales.push({billId,date,productId:item.productId,name:item.name,quantity:item.quantity,price:item.price,total:item.price*item.quantity});
  });
  const receipt=`<strong>Bill completed — ${billId}</strong><br>${cart.map(i=>`${escapeHTML(i.name)} × ${i.quantity}: ${money(i.price*i.quantity)}`).join("<br>")}<br><strong>Total: ${money(cart.reduce((s,i)=>s+i.price*i.quantity,0))}</strong><br><span class="muted">${date}</span>`;
  $("lastReceipt").innerHTML=receipt;
  cart=[];saveData();render();$("billMessage").textContent="Sale completed. Stock has been updated.";
});

$("exportSales").addEventListener("click",()=>{
  if(!sales.length){alert("There are no sales records to export.");return;}
  const rows=[["Bill ID","Date","Product ID","Product Name","Quantity","Unit Price","Total"],...sales.map(s=>[s.billId,s.date,s.productId,s.name,s.quantity,s.price,s.total])];
  const csv=rows.map(row=>row.map(value=>'"'+String(value).replace(/"/g,'""')+'"').join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download="sales.csv";link.click();URL.revokeObjectURL(link.href);
});

render();
