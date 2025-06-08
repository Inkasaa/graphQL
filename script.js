

/*FILTER! :
const xpQuery = `
query {
  transaction(
    where: {
      _and: [
        { event: { path: { _eq: "/gritlab/school-curriculum" }}},
        { type: { _eq: "xp" } }
      ]
    }
    order_by: { createdAt: asc }
  ) {
    amount
    createdAt
    path
  }
}
`*/
const loginContainer = document.getElementById("login-container");
const profileContainer = document.getElementById("profile-container");
const userLogin = document.getElementById("user-login");
const totalXpEl = document.getElementById("total-xp");
const loginError = document.getElementById("login-error");

const graphqlPath = `https://01.gritlab.ax/api/graphql-engine/v1/graphql`;

let jwt = null;

async function login() {
  const username = document.getElementById("username").value;
  console.log('username:', username)
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
        id
        login
        attrs
        campus
        labels {
            labelId
            labelName
        }
        createdAt
        updatedAt
        auditRatio
        totalUp
        totalUpBonus
        totalDown
    }
    
    wip: progress (
        where: {isDone: {_eq: false}, grade : {_is_null: true}}
        order_by: [{createdAt: asc}]
    ){
        id
        eventId
        createdAt
        updatedAt
        path
        group{
            members{
                userLogin
            }
        }
    }
    transaction {
      id
      path
      amount
      type
  }
    progress {
      grade
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
      return data
    } else {
      response.json().then(errorData => { showMessage(errorData.error) });
    }
  }).catch(error => {
    console.error("Error:", error);
    showMessage("An error occurred. Please check your connection.");
  });
};

async function loadProfile() {

  const data = await executeGraphql(userQuery)
  const user = data.data.user[0];
  const transactions = data.data.transaction;

  userLogin.textContent = user.login;

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
    !t.path.includes('/gritlab/school-curriculum/piscine-js/') &&
    !t.path.includes('/gritlab/school-curriculum/piscine-go/') &&
    !t.path.includes('/gritlab/school-curriculum/checkpoint')
  );
   console.log(xpProjects)
   //console.log(grades)
  const xpGoCheckpoints = transactions.filter(t => 
    t.type === 'xp' &&
    t.path.startsWith('/gritlab/school-curriculum/checkpoint/')
  
  );
  
    const xpJSCheckpoints = transactions.filter(t => 
    t.type === 'xp' &&
    t.path.startsWith('/gritlab/school-curriculum/checkpoint-js')
  
  );

  //console.log(transactions)
  //console.log(xpGoCheckpoints)

  const totalXp = xpTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalJSCheckpointXp = xpJSCheckpoints.reduce((sum, t) => sum + t.amount, 0);
  const totalGoCheckpointXp = xpGoCheckpoints.reduce((sum, t) => sum + t.amount, 0);
  const totalProjectsXp = totalXp - totalGoCheckpointXp - totalJSCheckpointXp

  totalXpEl.textContent = totalXp;

  drawXpBarChart(xpProjects);
  drawXpPieChart(totalJSCheckpointXp, totalGoCheckpointXp, totalProjectsXp);
}

function drawXpBarChart(transactions) {
  const svg = document.getElementById("xp-bar");
  svg.innerHTML = "";
  if (!transactions || transactions.length === 0) return;

  const width = svg.width.baseVal.value;
  const height = svg.height.baseVal.value;

  const topMargin = 20;
  const bottomMargin = 60; // lisää tilaa tekstille

  const maxXp = Math.max(...transactions.map(t => t.amount));
  const barSpacing = 2;
  const barWidth = Math.max((width - 2 * topMargin) / transactions.length - barSpacing, 1);

transactions.forEach((t, i) => {
  const barHeight = (t.amount / maxXp) * (height - topMargin - bottomMargin);
  const x = topMargin + i * (barWidth + barSpacing);
  const y = height - bottomMargin - barHeight;

  // Pylväs
  svg.innerHTML += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" class="xp-bar" />`;

  // XP määrä pylvään yläpuolelle
  svg.innerHTML += `<text x="${x + barWidth / 2}" y="${y - 5}" font-size="6" text-anchor="middle" fill="#000">${t.amount}</text>`;

  // Projektiotsikko pylvään alle
  const label = t.path.split('/').pop().replace(/-/g, ' ');
  const textY = height - 35;
  svg.innerHTML += `<text x="${x + barWidth / 2}" y="${textY}" font-size="8" text-anchor="middle" transform="rotate(-30 ${x + barWidth / 2},${textY})">${label}</text>`;
});
}





function drawXpPieChart(totalJSCheckpointXp, totalGoCheckpointXp, totalProjectsXp) {
  const svg = document.getElementById("xp-pie");
  svg.innerHTML = "";

  const data = [
    { label: "JS", value: totalJSCheckpointXp, color: "#ffa500" },
    { label: "Go", value: totalGoCheckpointXp, color: "#4caf50" },
    { label: "Projects", value: totalProjectsXp, color: "#8bc34a" },
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
      <text x="${legendX + 20}" y="${legendY + 12}" font-family="Arial" font-size="14">${d.label}</text>
    `;
    legendY += 25; // Siirrytään seuraavalle riville
  });
}


loadProfile();
