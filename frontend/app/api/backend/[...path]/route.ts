import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
async function forward(req:NextRequest,ctx:{params:Promise<{path:string[]}>}) {
 const {path}=await ctx.params;
 const origin=(process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/,"");
 const target=origin+"/"+path.map(encodeURIComponent).join("/")+req.nextUrl.search;
 try {
  const headers=new Headers();
  const contentType=req.headers.get("content-type");
  if(contentType) headers.set("content-type",contentType);
  const res=await fetch(target,{method:req.method,headers,body:req.method==="GET"?undefined:await req.arrayBuffer(),cache:"no-store",signal:AbortSignal.timeout(30000)});
  return new NextResponse(await res.arrayBuffer(),{status:res.status,headers:{"content-type":res.headers.get("content-type")||"application/json","cache-control":"no-store"}});
 }catch(err){return NextResponse.json({detail:"Backend unavailable. Check BACKEND_URL and that the Python API is running."},{status:502});}
}
export {forward as GET,forward as POST};
