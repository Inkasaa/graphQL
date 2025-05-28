

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
  console.log(data)
  const user = data.data.user[0];
  const transactions = data.data.transaction;
  const grades = data.data.progress;

  userLogin.textContent = user.login;

  const totalXp = transactions.reduce((sum, t) => sum + t.amount, 0);
  totalXpEl.textContent = totalXp;

  drawXPLineChart(transactions);
  drawPassFailPie(grades);
}

function drawXPLineChart(transactions) {
  const svg = document.getElementById("xp-line");
  svg.innerHTML = "";
  if (transactions.length === 0) return;

  const margin = 20;
  const width = svg.width.baseVal.value;
  const height = svg.height.baseVal.value;

  const maxXp = Math.max(...transactions.map(t => t.amount));
  const xStep = (width - 2 * margin) / (transactions.length - 1);

  transactions.forEach((t, i) => {
    const x = margin + i * xStep;
    const y = height - margin - (t.amount / maxXp) * (height - 2 * margin);

    svg.innerHTML += `<circle cx="${x}" cy="${y}" r="3" fill="#a44fff" />`;

    if (i > 0) {
      const prev = transactions[i - 1];
      const px = margin + (i - 1) * xStep;
      const py = height - margin - (prev.amount / maxXp) * (height - 2 * margin);
      svg.innerHTML += `<line x1="${px}" y1="${py}" x2="${x}" y2="${y}" stroke="#a44fff" />`;
    }
  });
}

function drawPassFailPie(grades) {
  const svg = document.getElementById("pass-fail-pie");
  svg.innerHTML = "";

  const pass = grades.filter(g => g.grade === 1).length;
  const fail = grades.filter(g => g.grade === 0).length;
  const total = pass + fail;

  if (total === 0) return;

  const radius = 60;
  const cx = 75, cy = 75;
  const passAngle = (pass / total) * 2 * Math.PI;

  const x1 = cx + radius * Math.cos(0);
  const y1 = cy + radius * Math.sin(0);
  const x2 = cx + radius * Math.cos(passAngle);
  const y2 = cy + radius * Math.sin(passAngle);

  const largeArc = passAngle > Math.PI ? 1 : 0;

  svg.innerHTML += `
    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="#ffb3b3" />
    <path d="M${cx},${cy} L${x1},${y1} A${radius},${radius} 0 ${largeArc} 1 ${x2},${y2} Z"
          fill="#a44fff" />
  `;
}

loadProfile();
