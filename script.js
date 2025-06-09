const graphqlPath = `https://01.gritlab.ax/api/graphql-engine/v1/graphql`;

let jwt = null;

async function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const credentials = btoa(`${username}:${password}`);

  try {
    const res = await fetch("https://01.gritlab.ax/api/auth/signin", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    });

    if (!res.ok) throw new Error("Invalid credentials");
    jwt = await res.json();
    localStorage.setItem("jwt", jwt);
    loadProfile();
    loginContainer.classList.add('hidden')
    profileContainer.classList.remove('hidden')
  } catch (err) {
    loginError.textContent = err.message;
  }
}

function logout() {
  localStorage.removeItem("jwt");
  location.reload();
}

const userQuery = `
{
    user {
        login
        attrs
        auditRatio
    }
    
    wip: progress (
        where: {isDone: {_eq: true }, grade : {_is_null: false}
        }

    ){
        group {
            members{
                userLogin             
            }
        }
    }
    transaction {
      path
      amount
      type
  }

}`;

const generateQueryJson = (queryStr) => JSON.stringify({ query: queryStr });

async function executeGraphql(query) {
  const jwtToken = localStorage.getItem("jwt");
  return fetch(graphqlPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`
    },
    body: generateQueryJson(query)
  }).then(response => {
    if (response.ok) {
      const data = response.json();
      console.log(data)
      return data
    } else {
      response.json().then(errorData => { showMessage(errorData.error) });
    }
  }).catch(error => {
    console.error("Error:", error);
    showMessage("An error occurred. Please check your connection.");
  });
};

const loginContainer = document.getElementById("login-container");
const profileContainer = document.getElementById("profile-container");
const userLogin = document.getElementById("user-login");
const firstName = document.getElementById("first-name");
const lastName = document.getElementById("last-name")
const auditRatio = document.getElementById("audit-ratio")
const totalXpEl = document.getElementById("total-xp");
const loginError = document.getElementById("login-error");
const collaborators = document.getElementById("collaborators")

async function loadProfile() {
  const data = await executeGraphql(userQuery)

  const user = data.data.user[0];

  userLogin.textContent = user.login;
  firstName.textContent = user.attrs.firstName
  lastName.textContent = user.attrs.lastName;
  auditRatio.textContent = user.auditRatio.toFixed(2);
 
  const groupMembers = new Set();
  const wip = data.data.wip;

wip
  .filter(entry => entry.group !== null) // only entries with group
  .forEach(entry => {
    entry.group.members.forEach(member => {
      if (member.userLogin !== user.login) {
        groupMembers.add(member.userLogin);
      }
    });
  });
  
  collaborators.textContent = Array.from(groupMembers).join(', ');

  const transactions = data.data.transaction;
  const xpTransactions = transactions.filter(t => 
    t.type === 'xp' &&
    t.path.startsWith('/gritlab/school-curriculum/') &&
    (
      !t.path.includes('/gritlab/school-curriculum/piscine-js/')  || // exclude sub-paths
      t.path === '/gritlab/school-curriculum/piscine-js' 
  )
  );

  const xpProjects = transactions.filter(t => 
    t.type === 'xp' &&
    t.path.startsWith('/gritlab/school-curriculum/') &&
    !t.path.includes('/gritlab/school-curriculum/piscine-js') &&
    !t.path.includes('/gritlab/school-curriculum/piscine-go/') &&
    !t.path.includes('/gritlab/school-curriculum/checkpoint')
  );

   const xpGoCheckpoints = transactions.filter(t => 
    t.type === 'xp' &&
    t.path.startsWith('/gritlab/school-curriculum/checkpoint/')
  );
  
    const xpJSCheckpoints = transactions.filter(t => 
    t.type === 'xp' &&
    t.path.startsWith('/gritlab/school-curriculum/checkpoint-js')
  );

    const xpJSPiscine = transactions.filter(t => 
    t.type === 'xp' &&
    t.path === '/gritlab/school-curriculum/piscine-js'
  );

  const totalXp = xpTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalJSCheckpointXp = xpJSCheckpoints.reduce((sum, t) => sum + t.amount, 0);
  const totalGoCheckpointXp = xpGoCheckpoints.reduce((sum, t) => sum + t.amount, 0);
  const totalProjectsXp = xpProjects.reduce((sum, t) => sum + t.amount, 0);
  const jsPiscineXp = xpJSPiscine.reduce((sum, t) => sum + t.amount, 0)

  totalXpEl.textContent = totalXp/1000;

  drawXpBarChart(xpProjects);
  drawXpPieChart(totalJSCheckpointXp, totalGoCheckpointXp, totalProjectsXp, jsPiscineXp);
}

function drawXpBarChart(transactions) {
  const svg = document.getElementById("xp-bar");
  svg.innerHTML = "";
  if (!transactions || transactions.length === 0) return;

  const width = svg.width.baseVal.value;
  const height = svg.height.baseVal.value;

  const topMargin = 30; // space above the bars
  const bottomMargin = 60; // space below the bars

  const maxXp = Math.max(...transactions.map(t => t.amount));
  const barSpacing = 2;
  const barWidth = Math.max((width - 2 * topMargin) / transactions.length - barSpacing, 1);

transactions.forEach((t, i) => {
  const barHeight = (t.amount / maxXp) * (height - topMargin - bottomMargin);
  const x = topMargin + i * (barWidth + barSpacing);
  const y = height - bottomMargin - barHeight;

  // Pylväs
  svg.innerHTML += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" class="xp-bar" />`;

  // Project xp
  svg.innerHTML += `<text x="${x + barWidth / 2}" y="${y - 5}" font-size="10" text-anchor="middle" fill="#000">${t.amount/1000}</text>`;

  // Project name
  const label = t.path.split('/').pop().replace(/-/g, ' ');
  const textY = height - 30;
  svg.innerHTML += `<text x="${x + barWidth / 2}" y="${textY}" font-size="10" text-anchor="middle" transform="rotate(-30 ${x + barWidth / 2},${textY})">${label}</text>`;
});
}

function drawXpPieChart(totalJSCheckpointXp, totalGoCheckpointXp, totalProjectsXp, jsPiscineXp) {
  const svg = document.getElementById("xp-pie");
  svg.innerHTML = "";

  const data = [
    { label: "Go-checkpoints", value: totalGoCheckpointXp, color: "#8bc34a" },
        { label: "Js-checkpoints", value: totalJSCheckpointXp, color: "#e91e63"},
    { label: "Js-piscine", value: jsPiscineXp, color: "#ffa500" },
    { label: "Projects", value: totalProjectsXp, color: "black"},
  ];

  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return;

  const cx = 75, cy = 75, radius = 60;
  let startAngle = 0;

  // Piirretään piirakka
  data.forEach(d => {

    const sliceAngle = (d.value / total) * 2 * Math.PI;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(startAngle + sliceAngle);
    const y2 = cy + radius * Math.sin(startAngle + sliceAngle);

    const largeArc = sliceAngle > Math.PI ? 1 : 0;

    svg.innerHTML += `
      <path d="M${cx},${cy} L${x1},${y1} A${radius},${radius} 0 ${largeArc} 1 ${x2},${y2} Z"
            fill="${d.color}" />
    `;

    startAngle += sliceAngle;
  });

  // Lisätään selitykset (legend)
  // Legendan alkuperäinen sijainti piirakan oikealle puolelle
  const legendX = cx + radius + 20;
  let legendY = cy - radius;

  data.forEach(d => {
    // Värillinen neliö
    svg.innerHTML += `
      <rect x="${legendX}" y="${legendY}" width="15" height="15" fill="${d.color}" />
      <text x="${legendX + 20}" y="${legendY + 12}" font-family="Arial" font-size="14">${d.label}: ${d.value/ 1000}</text>
    `;
    legendY += 25; // Siirrytään seuraavalle riville
  });
}
loadProfile();
