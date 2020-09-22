const fs = require('fs')
const os = require('os')
const dns = require('dns')
const path = require('path')

const qrcode = require('qrcode-terminal')

const fileUpload = require('express-fileupload')
const cors = require('cors')
const bodyParser = require('body-parser')
const morgan = require('morgan')
const _ = require('lodash')

const express = require('express')
const app = express()
const port = 3000

let qr = ""
pre()

function pre(){
  getQRCode(function(qrt){
    qr = qrt
    init()
  })
}

function init(){
  // enable files upload
  app.use(fileUpload({
      createParentPath: true
  }));

  //add other middleware
  app.use(cors())
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({extended: true}))
  app.use(morgan('dev'))

  app.use("/scripts", express.static(__dirname + '/scripts'))
  app.use("/images", express.static(__dirname + '/images'))

  app.get('/', (req, res) => returnWetPage(req,res))
  app.get('/addwater', (req, res) => res.sendFile(path.join(__dirname + '/addwater.html')))
  app.post('/splash', async (req, res) => {
    try {
      if(!req.files || !req.body) { res.send({ status: false, message: 'No file upload' }) }
      else {
        let body = req.body
        let data = []
        body.title = req.body.title.trim().replace(/ /g, '_') || `fart_from_fart_town_${Math.floor(Math.random()*100000)}`
        body.filePath = `./files/${req.body.date}-${body.title}`
        // console.log(body)

        if(!Array.isArray(body.photoData)){
          body.photoData = [body.photoData]
        }

        body.photos = []
        if (req.files.photos.length > 1 ){
          _.forEach(req.files.photos, (p, i) => {
            let photo = p
            let name = `${body.title}-${i}.${photo.mimetype.split('/')[1]}`
            body.photos.push(name)
            photo.mv(`${body.filePath}/${name}`)
          })
        } else {
          photo = req.files.photos
          let name = `${body.title}-0.${photo.mimetype.split('/')[1]}`
          body.photos.push(name)
          photo.mv(`${body.filePath}/${name}`)
        }

        // make file
        let file = makeMdFile(body)
        let fileName = `${body.date}-${body.title}.html`

        // update json index
        updateJSONDB(body)

        if(fs.existsSync(body.filePath)){
          fs.writeFileSync(body.filePath + '/' + fileName , file)
        } else {
          fs.mkdirSync(body.filePath, function(){
            fs.writeFileSync(body.filePath + '/' + fileName , file)
          })
        }

        // addtojson
        // todo
	console.log(`${body.title} written to ${body.filepath} with ${body.photos.length} images`)
        //return status
        res.send({
          status: true,
          message: 'Photos gone where they belong',
        })
      }
    } catch(err) {
      console.log(err)
      res.status(500).send(err)
    }
  })

  app.listen(port, () => console.log(`Get down to business <3`))
  console.log(qr)
  function returnWetPage(req,res){
      var r = `
        check ya console
        <script>
          console.log("here it is")
          console.log(\`${qr}\`)
        </script>
      `
      res.send(r)
  }
}

function getQRCode(cb){
  var address = os.networkInterfaces()['en0'][1].address
  qrcode.generate(
    `http://${address}:${port}/addwater`,
    {small: true},
    function(qr){ cb(qr) })
}

function makeMdFile(body){
  let photos = "";
  body.photos.forEach((item, i) => {
    currData = JSON.parse(body.photoData[i])
    photos += `<img src="${item}" alt="${currData.alt}" title="${currData.title}"/>\n`
  });
  let md = "";
  md += photos
  md += `<h1>${body.title.trim()}</h1>\n`
  md += `<p class="content">${body.content}<p>\n`
  md += `<p class="date">${body.date}</p>\n`
  return md
}

function updateJSONDB(body){
  if(!fs.existsSync('files/index.json')){
    fs.writeFileSync('files/index.json', '')
  }
  let json = fs.readFileSync('files/index.json', 'utf8') || '[]'
  let indexObject = JSON.parse(json)
  let uploadObj = {
    title : body.title,
    content : body.content,
    date : body.date,
    images: []
  }
  body.photos.forEach((ph,i) => {
    let currData = JSON.parse(body.photoData[i])
    let phO = {
      src:`${body.filePath}/${ph}`,
      alt: currData.alt,
      title: currData.title
    }
    uploadObj.images.push(phO)
  })
  indexObject.push(uploadObj);
  fs.writeFileSync('files/index.json', JSON.stringify(indexObject, null, '\t'))
}
