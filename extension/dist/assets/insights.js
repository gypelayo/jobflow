import{b as S,c as w}from"./dashboard.js";import"./pdf.js";import"./sql.js";const O=10,N=3,b=1.5,v="('interview-hr','interview-tech-intro','interview-tech-system','interview-tech-code','offer')";function h(n){return n>=20?"high":n>=8?"medium":"low"}function f(n,o){return o===0?0:Math.round(n/o*100)}function y(n,o){return o===0?0:Math.round(n/o*10)/10}async function m(n,o,i){const t=(await S()).exec(`
    SELECT
      ${o} as dim,
      COUNT(*) as total,
      SUM(CASE WHEN max_status IN ${v} THEN 1 ELSE 0 END) as responses
    FROM jobs
    WHERE max_status != 'saved'
      AND ${o} IS NOT NULL
      AND ${o} != ''
    GROUP BY ${o}
    HAVING COUNT(*) >= ${N}
    ORDER BY ${o}
  `);if(!t.length||t[0].values.length<2)return null;const c=t[0].values.map(p=>{const d=p[0]??"",$=p[1]??0,g=p[2]??0;return{label:(i==null?void 0:i[d])??d,applied:$,responses:g,rate:f(g,$)}});if(c.length<2)return null;const u=[...c].sort((p,d)=>d.rate-p.rate),e=u[0],r=u[u.length-1];if(e.rate===0||r.rate===0&&e.rate<20||r.rate>0&&y(e.rate,r.rate)<b)return null;const a=c.reduce((p,d)=>p+d.applied,0),l=r.rate>0?`${y(e.rate,r.rate)}×`:`${e.rate}% vs 0%`,T={company_size:"company size",seniority_level:"seniority level",workplace_type:"workplace type",industry:"industry"}[o]??o;return{id:n,level:"positive",confidence:h(a),headline:`${e.label} responds ${l} more often`,description:`Of your ${a} applications, ${e.label} roles have the highest response rate at ${e.rate}%${r.rate>0?`, compared to ${r.rate}% for ${r.label}`:""}.`,action:`Focus your next applications on ${e.label} ${T} roles.`,sampleSize:a,data:u}}async function _(n){if(!n)return null;const i=(await S()).exec(`
    SELECT seniority_level, COUNT(*) as cnt
    FROM jobs
    WHERE max_status != 'saved'
      AND seniority_level IS NOT NULL
      AND seniority_level != ''
    GROUP BY seniority_level
  `);if(!i.length||!i[0].values.length)return null;const s={};let t=0;for(const a of i[0].values){const l=a[0].toLowerCase(),E=a[1]??0;s[l]=E,t+=E}if(t<N)return null;const c=(s.senior??0)+(s.staff??0)+(s.principal??0)+(s.lead??0),u=(s.junior??0)+(s.mid??0),e=f(c,t),r=f(u,t);return n<3&&e>=50?{id:"seniority-mismatch",level:"warning",confidence:h(t),headline:`${e}% of your applications target Senior+ roles with ${n} YoE`,description:`You have ${n} year${n===1?"":"s"} of experience, but ${e}% of your applications are for Senior, Staff, or Lead roles. These typically expect 5+ years.`,action:"Try applying to more Mid-level roles — you are likely to get a much higher response rate.",sampleSize:t,data:Object.entries(s).map(([a,l])=>({label:a,applied:l,responses:0,rate:f(l,t)})).sort((a,l)=>l.applied-a.applied)}:n>=7&&r>=50?{id:"seniority-mismatch",level:"warning",confidence:h(t),headline:`${r}% of your applications target Junior/Mid roles with ${n} YoE`,description:`You have ${n} years of experience but ${r}% of your applications are for Junior or Mid-level roles. You may be undervaluing yourself.`,action:"Try targeting Senior or Staff roles — your experience level justifies it.",sampleSize:t,data:Object.entries(s).map(([a,l])=>({label:a,applied:l,responses:0,rate:f(l,t)})).sort((a,l)=>l.applied-a.applied)}:null}async function I(){const o=(await S()).exec(`
    SELECT
      s.skill_name,
      COUNT(DISTINCT j.id) as total,
      SUM(CASE WHEN j.max_status IN ${v} THEN 1 ELSE 0 END) as responses
    FROM job_skills s
    JOIN jobs j ON j.id = s.job_id
    WHERE j.max_status != 'saved'
    GROUP BY s.skill_name
    HAVING COUNT(DISTINCT j.id) >= ${N}
    ORDER BY (CAST(SUM(CASE WHEN j.max_status IN ${v} THEN 1 ELSE 0 END) AS FLOAT) / COUNT(DISTINCT j.id)) DESC
    LIMIT 20
  `);if(!o.length||o[0].values.length<4)return null;const i=o[0].values.map(e=>({label:e[0]??"",applied:e[1]??0,responses:e[2]??0,rate:f(e[2]??0,e[1]??0)})),s=i[0],t=i[i.length-1];if(s.rate===0||t.rate>0&&y(s.rate,t.rate)<b)return null;const c=i.reduce((e,r)=>e+r.applied,0),u=i.slice(0,3).map(e=>e.label).join(", ");return{id:"top-skills",level:"positive",confidence:h(c),headline:`${s.label} jobs respond to you ${t.rate>0?`${y(s.rate,t.rate)}×`:`${s.rate}% vs ${t.rate}%`} more often`,description:`Your best-performing skills by response rate are ${u}. Roles requiring these skills are more likely to advance you past the application stage.`,action:`Prioritise roles that prominently feature ${s.label} in their requirements.`,sampleSize:c,data:i.slice(0,8)}}async function L(){var e,r;const i=((r=(e=(await S()).exec("SELECT COUNT(*) FROM jobs WHERE max_status != 'saved'")[0])==null?void 0:e.values[0])==null?void 0:r[0])??0;if(i<O)return{insights:[],appliedCount:i,hasEnoughData:!1};const s=await w(),t={"10-50":"Startup (10-50)","51-200":"Series B (51-200)","50-200":"Series B (50-200)","201-1000":"Mid-size (201-1000)","200-1000":"Mid-size (200-1000)","1001+":"Enterprise (1000+)","1000+":"Enterprise (1000+)"};return{insights:(await Promise.all([m("company-size","company_size",t),m("seniority","seniority_level",null),m("workplace","workplace_type",null),m("industry","industry",null),_((s==null?void 0:s.yearsExperience)??0),I()])).filter(a=>a!==null),appliedCount:i,hasEnoughData:!0}}export{O as MIN_APPLIED_JOBS,L as computeInsights};
