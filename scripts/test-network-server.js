/**
 * خادم اختبار بسيط على المنفذ 9999 للتحقق من إمكانية الوصول من جهاز آخر.
 * شغّل: node scripts/test-network-server.js
 * من الجهاز الآخر افتح: http://<IP-جهازك>:9999
 * إذا فتحت الصفحة = الشبكة تسمح بالاتصال، والمشكلة من تطبيق Vite أو المنفذ 3000.
 * إذا لم تفتح = الراوتر أو إعدادات الشبكة تمنع الاتصال بين الأجهزة.
 */
const http = require('http')
const port = 9999
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end('<h1>تم الوصول بنجاح من جهاز آخر</h1><p>الشبكة تعمل. المشكلة ليست من الراوتر.</p>')
})
server.listen(port, '0.0.0.0', () => {
  const { networkInterfaces } = require('os')
  const nets = networkInterfaces()
  let ip = '؟'
  for (const name of Object.keys(nets)) {
    for (const n of nets[name]) {
      if (n.family === 'IPv4' && !n.internal) {
        ip = n.address
        if (ip.startsWith('192.168.') || ip.startsWith('10.')) break
      }
    }
    if (ip !== '؟') break
  }
  console.log('')
  console.log('خادم الاختبار يعمل.')
  console.log('من الجهاز الآخر افتح المتصفح واكتب:')
  console.log('  http://' + ip + ':' + port + '/')
  console.log('')
  console.log('إذا ظهرت صفحة "تم الوصول بنجاح" فالشبكة سليمة.')
  console.log('اضغط Ctrl+C لإيقاف الخادم.')
  console.log('')
})
