import fs from 'node:fs';
import path from 'node:path';

const auditDir=path.join(process.cwd(),'audit');
const mdPath=path.join(auditDir,'latest-report.md');
const sources=[
  ['기존 기능 회귀 검사',path.join(auditDir,'latest-report.json')],
  ['v13 기능 검사',path.join(auditDir,'v13-report.json')]
];
const sections=[];
const checks=[];
for(const [label,file] of sources){
  if(!fs.existsSync(file)) continue;
  const data=JSON.parse(fs.readFileSync(file,'utf8').trim());
  const sourceChecks=Array.isArray(data.checks)?data.checks:[];
  sections.push({label,checks:sourceChecks});
  checks.push(...sourceChecks.map(check=>({...check,group:label})));
}
const failures=checks.filter(check=>check.pass===false);
const passed=checks.filter(check=>check.pass===true).length;
const decision=checks.length&&failures.length===0?'GO':'NO_GO';
const score=checks.length?Math.round(passed/checks.length*100):0;
const lines=[
  '# 맞팔체커 v13 출시 준비 보고서',
  '',
  `- 생성 시각: ${new Date().toISOString()}`,
  `- 커밋: ${process.env.GITHUB_SHA||'-'}`,
  `- 판정: **${decision}**`,
  `- 점수: **${score}/100**`,
  `- 통과: ${passed}/${checks.length}`,
  '',
  ...sections.flatMap(section=>[
    `## ${section.label}`,
    '',
    ...section.checks.map(check=>`- ${check.pass?'✅':'❌'} ${check.name}`),
    ''
  ]),
  '## 출시 차단 항목',
  '',
  ...(failures.length?failures.map(item=>`- ${item.group}: ${item.name}`):['- 없음']),
  ''
];
fs.writeFileSync(mdPath,lines.join('\n'));
console.log(JSON.stringify({decision,score,passed,total:checks.length,failures:failures.length}));
if(decision!=='GO') process.exitCode=1;
