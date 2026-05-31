// Genera HTML para imprimir la nota en media hoja A4 (dos mitades en un A4)
// y abre el diálogo de impresión/PDF del navegador.

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function fmtDate(iso) {
  return iso ? iso.split('-').reverse().join('/') : ''
}

const DIAS_PDF  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
const MESES_PDF = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
function fmtDateES(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${DIAS_PDF[dt.getDay()]} ${d} de ${MESES_PDF[m - 1]} del ${y}`
}

function fmtMoney(n) {
  const num = Number(n) || 0
  return num > 0
    ? '$' + num.toLocaleString('es-MX', { minimumFractionDigits: 2 })
    : '-'
}

async function getLogo() {
  try {
    const res  = await fetch('/bakinglove-logo.png')
    const blob = await res.blob()
    return await new Promise(resolve => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.readAsDataURL(blob)
    })
  } catch (_) {
    return null
  }
}

export async function printNota({
  folio, fecha, hora, cli, lugar, costo, tel,
  ubicSel, prods, obs, pagos,
  costoEntrega, totalGeneral, resta,
}) {
  const logoSrc = await getLogo()

  const logoHTML = logoSrc
    ? `<img src="${logoSrc}" alt="Bakinglove" style="width:100px;height:auto;object-fit:contain;flex-shrink:0;">`
    : `<span style="font-size:14pt;font-style:italic;color:#d9748f;font-weight:800;">Bakinglove</span>`

  // ── Filas de productos (solo las que tienen descripción) ───
  const prodRows = prods
    .filter(p => p.descripcion && String(p.descripcion).trim())
    .map(p => {
      const sub = (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioU) || 0)
      return (
        '<tr>' +
          `<td class="c">${esc(p.cantidad)}</td>` +
          `<td>${esc(p.descripcion)}</td>` +
          `<td class="c">${p.precioU ? fmtMoney(p.precioU) : ''}</td>` +
          `<td class="r">${sub > 0 ? fmtMoney(sub) : '-'}</td>` +
        '</tr>'
      )
    }).join('')

  const entregaRow = costoEntrega > 0
    ? '<tr><td colspan="2"></td><td style="text-align:right;font-size:7.5pt;color:#888;">+ Entrega</td>' +
      '<td class="r">' + fmtMoney(costoEntrega) + '</td></tr>'
    : ''

  // ── Filas de observaciones (solo llenas, mínimo 1 vacía) ───
  const filledObs = obs.filter(o => o && String(o).trim())
  const obsToRender = filledObs.length > 0 ? filledObs : ['']
  const obsRows = obsToRender.map((o, i) =>
    '<tr><td class="c" style="width:7mm;max-width:7mm;">' + (i + 1) + '</td><td>' + esc(o) + '</td></tr>'
  ).join('')

  // ── Filas de pagos (vista editable) ────────────────────────
  const pagoRows = pagos.map((p, i) =>
    '<tr>' +
      `<td class="c">${i + 1}</td>` +
      `<td>${p.monto ? fmtMoney(p.monto) : ''}</td>` +
      `<td>${fmtDate(p.fecha)}</td>` +
      `<td>${esc(p.met)}</td>` +
    '</tr>'
  ).join('')

  // ── Tags de ubicación ───────────────────────────────────────
  const tagBH = ubicSel === 'BELLO HORIZONTE'
    ? '<span class="tag bh active">BELLO HORIZONTE</span>'
    : ubicSel
      ? '<span class="tag bh dim">BELLO HORIZONTE</span>'
      : '<span class="tag bh">BELLO HORIZONTE</span>'

  const tagSR = ubicSel === 'SAN RAMON'
    ? '<span class="tag sr active">SAN RAMON</span>'
    : ubicSel
      ? '<span class="tag sr dim">SAN RAMON</span>'
      : '<span class="tag sr">SAN RAMON</span>'

  // ── HTML completo ────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Nota ${esc(folio)} · Bakinglove</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}

  /* ── Página A4, cada .half ocupa exactamente la mitad ── */
  @page{size:A4 portrait;margin:0;}
  html,body{
    font-family:"Plus Jakarta Sans",Arial,sans-serif;
    color:#2b2731;background:#fff;
    -webkit-print-color-adjust:exact;
    print-color-adjust:exact;
  }

  .half{
    width:210mm;
    height:148.5mm;       /* mitad de A4 */
    padding:5mm 9mm 4mm;
    overflow:hidden;
    display:flex;
    flex-direction:column;
    gap:1.6mm;
    page-break-after:always;
  }
  .half:last-child{page-break-after:auto;}

  /* ── Encabezado ── */
  .head{display:flex;align-items:flex-start;justify-content:space-between;gap:8mm;}
  h1{
    font-size:20pt;font-weight:800;text-transform:uppercase;
    line-height:.95;letter-spacing:-.5px;color:#111018;flex-shrink:0;
  }

  /* ── Folio + contacto ── */
  .toprow{display:flex;gap:6mm;align-items:flex-start;flex-wrap:wrap;}
  .folio-bar{
    display:inline-flex;align-items:stretch;
    border:1px solid #c9c9d0;border-radius:4px;overflow:hidden;
    height:8.5mm;flex-shrink:0;
  }
  .folio-bar .fl{
    background:#e4e4e8;font-weight:700;font-size:8pt;
    display:flex;align-items:center;padding:0 4mm;letter-spacing:.4px;white-space:nowrap;
  }
  .folio-bar .fv{
    display:flex;align-items:center;padding:0 5mm;
    color:#2f5fb0;font-weight:800;font-size:14pt;letter-spacing:.3px;white-space:nowrap;
  }
  .contact{font-size:7.5pt;line-height:1.65;color:#1a1a22;}
  .contact b{font-weight:700;}
  .cline{display:flex;align-items:center;gap:2.5mm;}
  .cline+.cline{margin-top:.8mm;}
  .ico-circle{
    width:4mm;height:4mm;border:1.5px solid #1f2b5e;border-radius:50%;
    display:flex;align-items:center;justify-content:center;flex-shrink:0;
    font-size:5.5pt;line-height:1;
  }
  .ico-pin{color:#d9748f;font-size:9pt;flex-shrink:0;line-height:1;}

  /* ── Tabla de campos ── */
  table{border-collapse:collapse;width:100%;}
  .fields td{border:1px solid #c9c9d0;height:5.8mm;font-size:8pt;vertical-align:middle;}
  .fields .lb{background:#e4e4e8;font-weight:700;padding:0 2.5mm;white-space:nowrap;width:1%;}
  .fields .vl{padding:0 2.5mm;}
  .fields .pk{background:#fbe0ea;}

  /* ── Tags ── */
  .tags{display:flex;gap:5px;}
  .tag{
    border:1px solid #c9c9d0;border-radius:4px;
    height:6.5mm;display:inline-flex;align-items:center;
    padding:0 3mm;font-size:8pt;font-weight:700;letter-spacing:.4px;
  }
  .tag.bh{color:#d9748f;}
  .tag.bh.active{background:#fbe0ea;border-color:#f4a0be;font-weight:800;}
  .tag.sr{background:#d9efd2;color:#5d8a49;border-color:#bfe0b4;}
  .tag.sr.active{font-weight:800;outline:2px solid #5d8a49;outline-offset:1px;}
  .tag.dim{background:#fff!important;color:#ccc!important;border-color:#eee!important;}

  /* ── Cabecera gris de sección ── */
  .barhead{
    background:#e4e4e8;text-align:center;font-weight:800;
    font-size:9pt;letter-spacing:1px;padding:2px;
    border:1px solid #c9c9d0;
  }

  /* ── Tablas de datos ── */
  .dt{border:1px solid #1f2b5e;}
  .dt thead th{
    background:#FBE0E8;color:#2b2731;font-size:7.5pt;font-weight:700;
    padding:2.5px 4px;border-right:1px solid rgba(217,116,143,.25);
    text-align:left;white-space:nowrap;
  }
  .dt td{
    border:1px solid #c9c9d0;padding:0 4px;
    height:6.5mm;font-size:8pt;vertical-align:middle;
  }
  .dt .c{text-align:center;font-weight:700;}
  .dt .r{text-align:right;color:#888;font-weight:700;}
  .dt tfoot td{font-weight:800;}

  /* ── Totales ── */
  .tots{border-collapse:collapse;width:52%;}
  .tots td{border:1px solid #c9c9d0;height:6.5mm;padding:0 3mm;font-size:9pt;vertical-align:middle;}
  .tots .tk{font-weight:800;letter-spacing:.4px;}
  .tots .tv{text-align:right;font-weight:700;color:#444;}

</style>
</head>
<body>

<!-- ═══════════════ MITAD SUPERIOR — NOTA PRINCIPAL ═══════════════ -->
<div class="half">

  <!-- Título + logo -->
  <div class="head">
    <h1>Nota<br>de&nbsp;venta</h1>
    ${logoHTML}
  </div>

  <!-- Folio + contacto -->
  <div class="toprow">
    <div class="folio-bar">
      <span class="fl">FOLIO</span>
      <span class="fv">${esc(folio)}</span>
    </div>
    <div class="contact">
      <div class="cline">
        <span class="ico-circle">☎</span>
        <b>222 116 40 61</b>
      </div>
      <div class="cline">
        <span class="ico-pin">&#9679;</span>
        <b>Calle Del Sol #68, Bello Horizonte</b>
      </div>
      <div class="cline">
        <span class="ico-pin">&#9679;</span>
        <b>Local 2, C Tulipanes, San Ramon</b>
      </div>
    </div>
  </div>

  <!-- Campos del pedido -->
  <table class="fields">
    <tr>
      <td class="lb">Fecha de Entrega</td>
      <td class="vl pk" colspan="3">${fmtDateES(fecha)}</td>
    </tr>
    <tr>
      <td class="lb">Cliente</td>
      <td class="vl" colspan="3">${esc(cli)}</td>
    </tr>
    <tr>
      <td class="lb">Lugar de Entrega</td>
      <td class="vl">${esc(lugar)}</td>
      <td class="lb">Hora de Entrega</td>
      <td class="vl">${esc(hora)}</td>
    </tr>
    <tr>
      <td class="lb">Costo por entrega</td>
      <td class="vl">${costo ? '$' + esc(costo) : ''}</td>
      <td class="lb">Contacto</td>
      <td class="vl">${esc(tel)}</td>
    </tr>
  </table>

  <!-- Ubicación -->
  <div class="tags">
    <span class="tag" style="background:#fff;color:#2b2731;">CONSUMO</span>
    ${tagBH}
    ${tagSR}
  </div>

  <!-- PEDIDO -->
  <div>
    <div class="barhead">PEDIDO</div>
    <table class="dt">
      <thead><tr>
        <th style="width:12%">CANTIDAD</th>
        <th>DESCRIPCION</th>
        <th style="width:13%">PRECIO U</th>
        <th style="width:13%">TOTAL</th>
      </tr></thead>
      <tbody>${prodRows}</tbody>
      <tfoot>
        ${entregaRow}
        <tr>
          <td colspan="2"></td>
          <td style="text-align:right;letter-spacing:.5px;">TOTAL</td>
          <td class="r">${fmtMoney(totalGeneral)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- OBSERVACIONES -->
  <div>
    <div class="barhead">OBSERVACIONES</div>
    <table class="dt"><tbody>${obsRows}</tbody></table>
  </div>

  <!-- PAGOS -->
  <div>
    <div class="barhead">PAGOS</div>
    <table class="dt">
      <thead><tr>
        <th style="width:7%">N°</th>
        <th style="width:22%">MONTO</th>
        <th style="width:22%">FECHA</th>
        <th>METODO DE PAGO</th>
      </tr></thead>
      <tbody>${pagoRows}</tbody>
    </table>
  </div>

  <!-- TOTAL / RESTA -->
  <table class="tots">
    <tr>
      <td class="tk">TOTAL</td>
      <td class="tv">${fmtMoney(totalGeneral)}</td>
    </tr>
    <tr>
      <td class="tk">RESTA</td>
      <td class="tv" style="color:${resta > 0 ? '#d9748f' : '#444'};">
        ${fmtMoney(Math.abs(resta))}
      </td>
    </tr>
  </table>

</div>

<script>
  // Esperar que la fuente cargue antes de imprimir
  document.fonts.ready.then(function() { window.print() })
</script>
</body>
</html>`

  const w = window.open('', '_blank', 'width=820,height=900')
  if (!w) { alert('Permite ventanas emergentes para generar el PDF'); return }
  w.document.write(html)
  w.document.close()
}

// ─── PDF del concentrado de notas (historial mensual) ───────────
export function printHistorial({ mesLabel, rows, acum, totalBancos, totalEfectivo, totalGeneral }) {
  function fm(n) {
    const num = Number(n) || 0
    return num > 0 ? '$' + num.toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '$ -'
  }
  function fs(n) {
    const num = Number(n) || 0
    return num > 0 ? '$' + num.toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '-'
  }

  const PAGO_COLOR = { Transferencia: '#e0f0fb', Efectivo: '#d9efd2', Terminal: '#ede8f7' }

  const dataRows = rows.map(({ idx, nota, producto, pago }) => {
    const fecha = nota?.fechaEntrega
      ? nota.fechaEntrega.split('-').slice(1).join('/')
      : nota ? new Date(nota.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' }) : ''
    const metodoPago = pago?.metodoPago || ''
    const bg = metodoPago ? (PAGO_COLOR[metodoPago] || '#fffbe6') : '#fffbe6'
    const monto = producto?.total > 0 ? fs(producto.total) : nota?.totalPedido > 0 ? fs(nota.totalPedido) : ''
    return `<tr>
      <td class="c dim">${idx}</td>
      <td>${esc(fecha)}</td>
      <td class="bold">${nota ? esc(nota.folio) : ''}</td>
      <td>${esc(producto?.descripcion || '')}</td>
      <td class="bold r">${esc(monto)}</td>
      <td class="bold" style="background:${bg}">${esc(metodoPago)}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Concentrado ${esc(mesLabel)} · Bakinglove</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  @page{size:A4 portrait;margin:12mm 10mm;}
  html,body{font-family:"Plus Jakarta Sans",Arial,sans-serif;color:#2b2731;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}

  h1{font-size:22pt;font-weight:800;text-transform:uppercase;letter-spacing:-.5px;color:#111018;}
  .sub{font-size:9pt;color:#888;font-weight:600;margin-top:1mm;margin-bottom:5mm;}

  .barhead{background:#e4e4e8;text-align:center;font-weight:800;font-size:9pt;letter-spacing:1px;padding:3px;border:1px solid #c9c9d0;margin-top:4mm;}

  table{border-collapse:collapse;width:100%;}
  thead tr{background:#E0EDDA;}
  thead th{color:#2b2731;font-size:8pt;font-weight:700;padding:4px 6px;border-right:1px solid rgba(116,160,95,.3);text-align:left;white-space:nowrap;}
  thead th:last-child{border-right:none;}
  tbody td{border:1px solid #c9c9d0;padding:3px 6px;font-size:8pt;vertical-align:middle;height:6.2mm;}
  tbody tr:nth-child(even) td{background:#fafafa;}

  .c{text-align:center;}
  .r{text-align:right;}
  .bold{font-weight:700;}
  .dim{color:#aaa;}

  .acum-grid{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #c9c9d0;margin-top:0;}
  .acum-head{background:#1f2b5e;color:#fff;font-size:8pt;font-weight:700;padding:4px 6px;text-align:center;border-right:1px solid rgba(255,255,255,.2);}
  .acum-head:last-child{border-right:none;}
  .acum-val{font-size:8.5pt;font-weight:700;padding:5px 6px;text-align:center;border-right:1px solid #c9c9d0;background:#d9efd2;}
  .acum-val:last-child{border-right:none;}

  .totals-table{width:52%;margin-top:4mm;}
  .totals-table td{border:1px solid #c9c9d0;padding:3px 8px;height:7mm;font-size:9pt;vertical-align:middle;}
  .tk{background:#1f2b5e;color:#fff;font-weight:700;}
  .tv{text-align:right;font-weight:700;}

  .total-gen{margin-top:1mm;background:#1f2b5e;color:#fff;display:flex;justify-content:space-between;padding:4px 8px;}
  .total-gen span{font-size:10pt;font-weight:800;}
</style>
</head>
<body>

<h1>Concentrado de Notas</h1>
<div class="sub">${esc(mesLabel)} · Bakinglove</div>

<!-- CONTROL DE INGRESOS -->
<div class="barhead">CONTROL DE INGRESOS</div>
<table>
  <thead>
    <tr>
      <th style="width:5%">#</th>
      <th style="width:10%">Fecha</th>
      <th style="width:12%">Nota de venta</th>
      <th>Producto</th>
      <th style="width:13%">Monto $</th>
      <th style="width:16%">Forma de pago</th>
    </tr>
  </thead>
  <tbody>${dataRows}</tbody>
</table>

<!-- ACUMULADO -->
<div class="barhead" style="margin-top:5mm;">ACUMULADO DE INGRESOS</div>
<div class="acum-grid">
  <div class="acum-head">Terminal</div>
  <div class="acum-head">Transferencia</div>
  <div class="acum-head">Efectivo</div>
  <div class="acum-val">${fs(acum.Terminal)}</div>
  <div class="acum-val">${fs(acum.Transferencia)}</div>
  <div class="acum-val">${fs(acum.Efectivo)}</div>
</div>

<!-- TOTALES -->
<table class="totals-table">
  <tr><td class="tk">Bancos</td><td class="tv">${fm(totalBancos)}</td></tr>
  <tr><td class="tk">Efectivo</td><td class="tv">${fm(totalEfectivo)}</td></tr>
</table>
<div class="total-gen" style="width:52%;">
  <span>Total General</span>
  <span>${fm(totalGeneral)}</span>
</div>

<script>document.fonts.ready.then(function(){ window.print() })</script>
</body>
</html>`

  const w = window.open('', '_blank', 'width=820,height=900')
  if (!w) { alert('Permite ventanas emergentes para generar el PDF'); return }
  w.document.write(html)
  w.document.close()
}
