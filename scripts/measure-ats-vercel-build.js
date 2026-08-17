#!/usr/bin/env node
'use strict';
var https=require('https');
var crypto=require('crypto');
var url='https://www.ats.edu/files/galleries/2025-2026_Annual_Data_Tables_r1-0001.pdf';
var req=https.get(url,{headers:{'user-agent':'LIMEN-Helix-ATS-byte-pin/1.0'}},function(res){
  var chunks=[];
  res.on('data',function(c){chunks.push(c);});
  res.on('end',function(){
    var body=Buffer.concat(chunks);
    var sha=crypto.createHash('sha256').update(body).digest('hex');
    console.error('ATS_VERCEL_PDF_MEASUREMENT status='+res.statusCode+' bytes='+body.length+' sha256='+sha+' contentType='+(res.headers['content-type']||''));
    process.exit(1);
  });
});
req.setTimeout(45000,function(){req.destroy(new Error('ATS probe timed out'));});
req.on('error',function(e){console.error('ATS_VERCEL_PDF_MEASUREMENT_ERROR '+e.message);process.exit(1);});
