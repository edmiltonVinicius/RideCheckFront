const CONFIG = {
  apiBase: 'http://localhost:3000',                 
  validatePath: '/v1/auth/password/validate',       
  resetPath: '/v1/auth/password/reset',           
  minLength: 8,
};

const $ = (id) => document.getElementById(id);

const states = {
  loading: $('state-loading'),
  invalid: $('state-invalid'),
  form: $('state-form'),
  success: $('state-success'),
};

const form = $('state-form');
const passwordInput = $('password');
const confirmInput = $('confirm');
const passwordError = $('password-error');
const confirmError = $('confirm-error');
const formError = $('form-error');
const submitButton = $('submit');
const togglePassword = $('toggle-password');
const toggleConfirm = $('toggle-confirm');

// Mostra só o estado pedido e esconde os outros
function showState(name) {
  Object.entries(states).forEach(([key, el]) => {
    el.hidden = key !== name;
  });
  if (name === 'form') passwordInput.focus();
}

// Lê token e userId e troca a URL para não deixar os dados no histórico nem em favoritos
function lerParametrosDaUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = (params.get('token') || '').trim();

    window.history.replaceState(null, '', window.location.pathname);

    if (!token) return null;

    return { token };
  } catch (erro) {
    return null;
  }
}

// Retorna true só quando a API responde { valid: true }
async function validarToken({ token }) {
  try {
    const resposta = await fetch(`${CONFIG.apiBase}${CONFIG.validatePath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ type: 'reset', token }),
    });
    if (!resposta.ok) return false;
    const dados = await resposta.json();
    return dados?.data?.valid === true;
  } catch (erro) {
    // Sem conexão ou resposta inesperada: tratamos como inválido, e o usuário pode pedir outro link
    return false;
  }
}

// Mensagens de erro de campo, sempre em português e sem detalhes técnicos
function validarCampos() {
  const senha = passwordInput.value;
  const confirmacao = confirmInput.value;
  let valido = true;

  passwordError.hidden = true;
  confirmError.hidden = true;
  passwordInput.removeAttribute('aria-invalid');
  confirmInput.removeAttribute('aria-invalid');

  const todosReqs = Object.values(reqs).every(r => r.test(senha));
  if (!todosReqs) {
    passwordError.textContent = 'Atenda a todos os requisitos de senha acima.';
    passwordError.hidden = false;
    passwordInput.setAttribute('aria-invalid', 'true');
    valido = false;
  }

  if (confirmacao !== senha) {
    confirmError.textContent = 'As senhas não coincidem.';
    confirmError.hidden = false;
    confirmInput.setAttribute('aria-invalid', 'true');
    valido = false;
  }

  return valido;
}

function mostrarErroGeral(mensagem) {
  formError.textContent = mensagem;
  formError.hidden = false;
}

function limparErroGeral() {
  formError.textContent = '';
  formError.hidden = true;
}

function definirCarregando(carregando) {
  submitButton.disabled = carregando;
  submitButton.classList.toggle('is-loading', carregando);
}

async function redefinirSenha({ token }, senha) {
  const resposta = await fetch(`${CONFIG.apiBase}${CONFIG.resetPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ token, newPassword: senha }),
  });

  if (resposta.ok) return { ok: true };

  // Token expirou ou já foi usado: volta para a tela de link inválido
  if ([400, 401, 404, 410].includes(resposta.status)) {
    return { ok: false, tokenInvalido: true };
  }

  let mensagem = 'Não foi possível redefinir sua senha agora. Tente novamente.';
  try {
    const dados = await resposta.json();
    if (dados && typeof dados.message === 'string' && dados.message.length < 200) {
      mensagem = dados.message;
    }
  } catch (erro) {
    // Resposta sem JSON: mantém a mensagem padrão
  }
  return { ok: false, mensagem };
}

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  limparErroGeral();

  if (!validarCampos()) return;

  const dadosLink = { token: form.dataset.token };
  definirCarregando(true);

  try {
    const resultado = await redefinirSenha(dadosLink, passwordInput.value);

    if (resultado.ok) {
      passwordInput.value = '';
      confirmInput.value = '';
      showState('success');
      return;
    }

    if (resultado.tokenInvalido) {
      showState('invalid');
      return;
    }

    mostrarErroGeral(resultado.mensagem);
  } catch (erro) {
    mostrarErroGeral('Sem conexão com o servidor. Verifique sua internet e tente de novo.');
  } finally {
    definirCarregando(false);
  }
});

// Barra de força e checklist de requisitos
const reqs = {
  length:  { el: $('req-length'),  test: (v) => v.length >= 8 },
  number:  { el: $('req-number'),  test: (v) => /\d/.test(v) },
  special: { el: $('req-special'), test: (v) => /[^A-Za-z0-9]/.test(v) },
};
const segs = [$('seg-1'), $('seg-2'), $('seg-3'), $('seg-4')];
const segsFilled = [0, 1, 2, 4]; // requisitos atendidos → segmentos ativos

function atualizarForca(valor) {
  const atendidos = Object.values(reqs).filter(r => r.test(valor)).length;
  Object.entries(reqs).forEach(([key, r]) => {
    const met = r.test(valor);
    r.el.dataset.met = String(met);
  });
  const ativos = segsFilled[atendidos];
  segs.forEach((seg, i) => seg.classList.toggle('active', i < ativos));
}

passwordInput.addEventListener('input', () => atualizarForca(passwordInput.value));

// Toggles de olho independentes por campo
function configurarToggle(btn, input) {
  const eyeOn  = btn.querySelector('.eye-icon:not(.eye-off)');
  const eyeOff = btn.querySelector('.eye-off');
  btn.addEventListener('click', () => {
    const mostrar = input.type === 'password';
    input.type = mostrar ? 'text' : 'password';
    eyeOn.hidden  = mostrar;
    eyeOff.hidden = !mostrar;
    btn.setAttribute('aria-pressed', String(mostrar));
    btn.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
  });
}

configurarToggle(togglePassword, passwordInput);
configurarToggle(toggleConfirm, confirmInput);

async function iniciar() {
  const link = lerParametrosDaUrl();

  if (!link) {
    showState('invalid');
    return;
  }

  showState('loading');
  const valido = await validarToken(link);

  if (!valido) {
    showState('invalid');
    return;
  }

  form.dataset.token = link.token;
  showState('form');
}

iniciar();