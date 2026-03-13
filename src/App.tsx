import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { db, auth } from "./firebase";

type Ministerio =
  | "Furnas"
  | "Labitare"
  | "Sede"
  | "Peri"
  | "Ministério no Tempo";

type Status = "Pendente" | "Parcial" | "Pago";

type Parcela = {
  num: number;
  paga: boolean;
  data?: string;
};

type Pessoa = {
  id: string;
  nome: string;
  telefone: string;
  ministerio: Ministerio;
  status: Status;
  totalPago: number;
  parcelas: Parcela[];
  criadoEm?: string;
};

type TipoEntrada =
  | "Dízimo"
  | "Oferta"
  | "Doação"
  | "Campanha"
  | "Evento"
  | "Outros";

type EntradaIgreja = {
  id: string;
  data: string;
  tipo: TipoEntrada;
  nome: string;
  valor: number;
  formaPagamento: string;
  observacao: string;
  criadoEm?: string;
};

type CategoriaSaida =
  | "Água"
  | "Luz"
  | "Internet"
  | "Aluguel"
  | "Manutenção"
  | "Conserto"
  | "Material"
  | "Ajuda social"
  | "Outros";

type SaidaIgreja = {
  id: string;
  data: string;
  categoria: CategoriaSaida;
  descricao: string;
  valor: number;
  formaPagamento: string;
  autorizadoPor: string;
  observacao: string;
  criadoEm?: string;
};

function makeParcelas(): Parcela[] {
  return Array.from({ length: 10 }, (_, i) => ({
    num: i + 1,
    paga: false,
  }));
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function moeda(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function calcularTotalPago(parcelas: Parcela[]) {
  return parcelas.filter((p) => p.paga).length * 100;
}

function calcularStatus(parcelas: Parcela[]): Status {
  const qtdPagas = parcelas.filter((p) => p.paga).length;
  if (qtdPagas === 0) return "Pendente";
  if (qtdPagas === 10) return "Pago";
  return "Parcial";
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [aba, setAba] = useState<
    "dashboard" | "terreno" | "entradas" | "saidas"
  >("dashboard");

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  // ===== TERRENO =====
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [ministerio, setMinisterio] = useState<Ministerio>("Sede");

  const [pesquisa, setPesquisa] = useState("");
  const [fMinisterio, setFMinisterio] = useState<string>("Todos");
  const [fStatus, setFStatus] = useState<string>("Todos");

  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const [editNome, setEditNome] = useState("");
  const [editTelefone, setEditTelefone] = useState("");
  const [editMinisterio, setEditMinisterio] = useState<Ministerio>("Sede");
  const [editStatus, setEditStatus] = useState<Status>("Pendente");
  const [editTotalPago, setEditTotalPago] = useState("0");
  const [editParcelas, setEditParcelas] = useState<Parcela[]>([]);

  // ===== ENTRADAS =====
  const [entradaData, setEntradaData] = useState(todayISO());
  const [entradaTipo, setEntradaTipo] = useState<TipoEntrada>("Dízimo");
  const [entradaNome, setEntradaNome] = useState("");
  const [entradaValor, setEntradaValor] = useState("");
  const [entradaFormaPagamento, setEntradaFormaPagamento] = useState("PIX");
  const [entradaObservacao, setEntradaObservacao] = useState("");
  const [entradas, setEntradas] = useState<EntradaIgreja[]>([]);

  // ===== SAÍDAS =====
  const [saidaData, setSaidaData] = useState(todayISO());
  const [saidaCategoria, setSaidaCategoria] =
    useState<CategoriaSaida>("Manutenção");
  const [saidaDescricao, setSaidaDescricao] = useState("");
  const [saidaValor, setSaidaValor] = useState("");
  const [saidaFormaPagamento, setSaidaFormaPagamento] = useState("PIX");
  const [saidaAutorizadoPor, setSaidaAutorizadoPor] = useState("");
  const [saidaObservacao, setSaidaObservacao] = useState("");
  const [saidas, setSaidas] = useState<SaidaIgreja[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setPessoas([]);
      setEntradas([]);
      setSaidas([]);
      return;
    }

    const unsubMembros = onSnapshot(collection(db, "membros"), (snap) => {
      const lista: Pessoa[] = snap.docs.map((d) => {
        const data: any = d.data();
        const parcelas = Array.isArray(data.parcelas)
          ? data.parcelas
          : makeParcelas();

        const totalPagoCalculado = calcularTotalPago(parcelas);
        const statusCalculado = calcularStatus(parcelas);

        return {
          id: d.id,
          nome: data.nome ?? "",
          telefone: data.telefone ?? "",
          ministerio: (data.ministerio ?? "Sede") as Ministerio,
          status: statusCalculado,
          totalPago: totalPagoCalculado,
          parcelas,
          criadoEm: data.criadoEm ?? "",
        };
      });

      lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      setPessoas(lista);
    });

    const unsubEntradas = onSnapshot(collection(db, "entradas_igreja"), (snap) => {
      const lista: EntradaIgreja[] = snap.docs.map((d) => {
        const data: any = d.data();
        return {
          id: d.id,
          data: data.data ?? "",
          tipo: data.tipo ?? "Dízimo",
          nome: data.nome ?? "",
          valor: Number(data.valor ?? 0),
          formaPagamento: data.formaPagamento ?? "",
          observacao: data.observacao ?? "",
          criadoEm: data.criadoEm ?? "",
        };
      });

      lista.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
      setEntradas(lista);
    });

    const unsubSaidas = onSnapshot(collection(db, "saidas_igreja"), (snap) => {
      const lista: SaidaIgreja[] = snap.docs.map((d) => {
        const data: any = d.data();
        return {
          id: d.id,
          data: data.data ?? "",
          categoria: data.categoria ?? "Manutenção",
          descricao: data.descricao ?? "",
          valor: Number(data.valor ?? 0),
          formaPagamento: data.formaPagamento ?? "",
          autorizadoPor: data.autorizadoPor ?? "",
          observacao: data.observacao ?? "",
          criadoEm: data.criadoEm ?? "",
        };
      });

      lista.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
      setSaidas(lista);
    });

    return () => {
      unsubMembros();
      unsubEntradas();
      unsubSaidas();
    };
  }, [user]);

  async function login() {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), senha);
      setSenha("");
    } catch (err) {
      console.error(err);
      alert("Erro ao entrar. Verifique e-mail e senha.");
    }
  }

  async function sair() {
    await signOut(auth);
  }

  // ===== TERRENO =====
  async function adicionarPessoa() {
    if (!nome.trim()) {
      alert("Digite o nome.");
      return;
    }

    if (!telefone.trim()) {
      alert("Digite o telefone.");
      return;
    }

    const parcelas = makeParcelas();

    try {
      await addDoc(collection(db, "membros"), {
        nome: nome.trim(),
        telefone: telefone.trim(),
        ministerio,
        status: calcularStatus(parcelas),
        totalPago: calcularTotalPago(parcelas),
        parcelas,
        criadoEm: new Date().toISOString(),
      });

      setNome("");
      setTelefone("");
      setMinisterio("Sede");
    } catch (err) {
      console.error(err);
      alert("Erro ao cadastrar.");
    }
  }

  function iniciarEdicao(p: Pessoa) {
    const parcelas = (p.parcelas ?? []).map((parc) => ({
      num: parc.num,
      paga: !!parc.paga,
      ...(parc.paga && parc.data ? { data: parc.data } : {}),
    }));

    setEditandoId(p.id);
    setEditNome(p.nome);
    setEditTelefone(p.telefone);
    setEditMinisterio(p.ministerio);
    setEditStatus(calcularStatus(parcelas));
    setEditTotalPago(String(calcularTotalPago(parcelas)));
    setEditParcelas(parcelas);
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setEditNome("");
    setEditTelefone("");
    setEditMinisterio("Sede");
    setEditStatus("Pendente");
    setEditTotalPago("0");
    setEditParcelas([]);
  }

  function toggleParcelaEdicao(num: number) {
    setEditParcelas((prev) => {
      const novas = prev.map((parc) => {
        if (parc.num !== num) return parc;

        const novaPaga = !parc.paga;

        if (novaPaga) {
          return {
            ...parc,
            paga: true,
            data: parc.data ?? todayISO(),
          };
        }

        return {
          num: parc.num,
          paga: false,
        };
      });

      const total = calcularTotalPago(novas);
      const status = calcularStatus(novas);

      setEditTotalPago(String(total));
      setEditStatus(status);

      return novas;
    });
  }

  async function salvarEdicao(id: string) {
    if (!editNome.trim()) {
      alert("Digite o nome.");
      return;
    }

    if (!editTelefone.trim()) {
      alert("Digite o telefone.");
      return;
    }

    const totalCalculado = calcularTotalPago(editParcelas);
    const statusCalculado = calcularStatus(editParcelas);

    try {
      await updateDoc(doc(db, "membros", id), {
        nome: editNome.trim(),
        telefone: editTelefone.trim(),
        ministerio: editMinisterio,
        status: statusCalculado,
        totalPago: totalCalculado,
        parcelas: editParcelas,
      });

      cancelarEdicao();
    } catch (err) {
      console.error(err);
      alert("Não consegui salvar as alterações.");
    }
  }

  async function excluirPessoa(id: string) {
    const ok = confirm("Deseja excluir esta pessoa?");
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "membros", id));
      if (editandoId === id) cancelarEdicao();
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir.");
    }
  }

  const pessoasFiltradas = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase();

    return pessoas.filter((p) => {
      const okPesquisa =
        !termo ||
        p.nome.toLowerCase().includes(termo) ||
        p.telefone.toLowerCase().includes(termo);

      const okMinisterio =
        fMinisterio === "Todos" || p.ministerio === fMinisterio;

      const okStatus = fStatus === "Todos" || p.status === fStatus;

      return okPesquisa && okMinisterio && okStatus;
    });
  }, [pessoas, pesquisa, fMinisterio, fStatus]);

  // ===== ENTRADAS =====
  async function adicionarEntrada() {
    const valor = Number(String(entradaValor).replace(",", "."));

    if (!entradaNome.trim()) {
      alert("Digite o nome.");
      return;
    }

    if (Number.isNaN(valor) || valor <= 0) {
      alert("Digite um valor válido.");
      return;
    }

    try {
      await addDoc(collection(db, "entradas_igreja"), {
        data: entradaData,
        tipo: entradaTipo,
        nome: entradaNome.trim(),
        valor,
        formaPagamento: entradaFormaPagamento,
        observacao: entradaObservacao.trim(),
        criadoEm: new Date().toISOString(),
      });

      setEntradaData(todayISO());
      setEntradaTipo("Dízimo");
      setEntradaNome("");
      setEntradaValor("");
      setEntradaFormaPagamento("PIX");
      setEntradaObservacao("");
    } catch (err) {
      console.error(err);
      alert("Erro ao cadastrar entrada.");
    }
  }

  async function excluirEntrada(id: string) {
    const ok = confirm("Deseja excluir esta entrada?");
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "entradas_igreja", id));
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir entrada.");
    }
  }

  // ===== SAÍDAS =====
  async function adicionarSaida() {
    const valor = Number(String(saidaValor).replace(",", "."));

    if (!saidaDescricao.trim()) {
      alert("Digite a descrição.");
      return;
    }

    if (Number.isNaN(valor) || valor <= 0) {
      alert("Digite um valor válido.");
      return;
    }

    try {
      await addDoc(collection(db, "saidas_igreja"), {
        data: saídaOuMesma(saidaData),
        categoria: saidaCategoria,
        descricao: saidaDescricao.trim(),
        valor,
        formaPagamento: saidaFormaPagamento,
        autorizadoPor: saidaAutorizadoPor.trim(),
        observacao: saidaObservacao.trim(),
        criadoEm: new Date().toISOString(),
      });

      setSaidaData(todayISO());
      setSaidaCategoria("Manutenção");
      setSaidaDescricao("");
      setSaidaValor("");
      setSaidaFormaPagamento("PIX");
      setSaidaAutorizadoPor("");
      setSaidaObservacao("");
    } catch (err) {
      console.error(err);
      alert("Erro ao cadastrar saída.");
    }
  }

  async function excluirSaida(id: string) {
    const ok = confirm("Deseja excluir esta saída?");
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "saidas_igreja", id));
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir saída.");
    }
  }

  // helper simples para evitar algum caractere invisível
  function saídaOuMesma(v: string) {
    return v;
  }

  // ===== DASHBOARD =====
  const totalTerrenoRecebido = useMemo(
    () => pessoas.reduce((acc, p) => acc + Number(p.totalPago || 0), 0),
    [pessoas]
  );

  const totalTerrenoFaltando = useMemo(
    () => pessoas.length * 1000 - totalTerrenoRecebido,
    [pessoas, totalTerrenoRecebido]
  );

  const totalEntradasIgreja = useMemo(
    () => entradas.reduce((acc, e) => acc + Number(e.valor || 0), 0),
    [entradas]
  );

  const totalSaidasIgreja = useMemo(
    () => saidas.reduce((acc, s) => acc + Number(s.valor || 0), 0),
    [saidas]
  );

  const saldoIgreja = totalEntradasIgreja - totalSaidasIgreja;

  if (!user) {
    return (
      <div style={pageStyle}>
        <div style={loginCardStyle}>
          <h2 style={{ marginTop: 0 }}>Login Tesouraria</h2>

          <div style={{ display: "grid", gap: 12 }}>
            <input
              style={inputStyle}
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              style={inputStyle}
              type="password"
              placeholder="Senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />

            <button style={btnPrimaryStyle} onClick={login}>
              Entrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div>
            <h1 style={{ margin: 0 }}>Controle Igreja</h1>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#555" }}>
              Logado como: <b>{user.email}</b>
            </p>
          </div>

          <button style={btnSecondaryStyle} onClick={sair}>
            Sair
          </button>
        </div>

        <div style={menuStyle}>
          <button
            style={aba === "dashboard" ? btnPrimaryStyle : btnSecondaryStyle}
            onClick={() => setAba("dashboard")}
          >
            Dashboard
          </button>

          <button
            style={aba === "terreno" ? btnPrimaryStyle : btnSecondaryStyle}
            onClick={() => setAba("terreno")}
          >
            Terreno
          </button>

          <button
            style={aba === "entradas" ? btnPrimaryStyle : btnSecondaryStyle}
            onClick={() => setAba("entradas")}
          >
            Entradas
          </button>

          <button
            style={aba === "saidas" ? btnPrimaryStyle : btnSecondaryStyle}
            onClick={() => setAba("saidas")}
          >
            Saídas
          </button>
        </div>
      </div>

      {aba === "dashboard" && (
        <div style={cardStyle}>
          <h2>Painel da Igreja</h2>

          <div style={gridResumoStyle}>
            <div style={miniCardStyle}>
              <div>Terreno arrecadado</div>
              <strong>{moeda(totalTerrenoRecebido)}</strong>
            </div>

            <div style={miniCardStyle}>
              <div>Terreno faltando</div>
              <strong>{moeda(totalTerrenoFaltando)}</strong>
            </div>

            <div style={miniCardStyle}>
              <div>Entradas igreja</div>
              <strong>{moeda(totalEntradasIgreja)}</strong>
            </div>

            <div style={miniCardStyle}>
              <div>Saídas igreja</div>
              <strong>{moeda(totalSaidasIgreja)}</strong>
            </div>

            <div style={miniCardStyle}>
              <div>Saldo igreja</div>
              <strong>{moeda(saldoIgreja)}</strong>
            </div>

            <div style={miniCardStyle}>
              <div>Membros terreno</div>
              <strong>{pessoas.length}</strong>
            </div>
          </div>
        </div>
      )}

      {aba === "terreno" && (
        <>
          <div style={cardStyle}>
            <h2>Cadastrar contribuinte do terreno</h2>

            <div style={formGridStyle}>
              <input
                style={inputStyle}
                placeholder="Nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />

              <input
                style={inputStyle}
                placeholder="Telefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />

              <select
                style={inputStyle}
                value={ministerio}
                onChange={(e) => setMinisterio(e.target.value as Ministerio)}
              >
                <option value="Furnas">Furnas</option>
                <option value="Labitare">Labitare</option>
                <option value="Sede">Sede</option>
                <option value="Peri">Peri</option>
                <option value="Ministério no Tempo">Ministério no Tempo</option>
              </select>
            </div>

            <div style={{ marginTop: 12 }}>
              <button style={btnPrimaryStyle} onClick={adicionarPessoa}>
                Adicionar
              </button>
            </div>
          </div>

          <div style={cardStyle}>
            <h2>Pesquisa</h2>

            <div style={formGridStyle}>
              <input
                style={inputStyle}
                placeholder="Pesquisar por nome ou telefone"
                value={pesquisa}
                onChange={(e) => setPesquisa(e.target.value)}
              />

              <select
                style={inputStyle}
                value={fMinisterio}
                onChange={(e) => setFMinisterio(e.target.value)}
              >
                <option value="Todos">Todos os ministérios</option>
                <option value="Furnas">Furnas</option>
                <option value="Labitare">Labitare</option>
                <option value="Sede">Sede</option>
                <option value="Peri">Peri</option>
                <option value="Ministério no Tempo">Ministério no Tempo</option>
              </select>

              <select
                style={inputStyle}
                value={fStatus}
                onChange={(e) => setFStatus(e.target.value)}
              >
                <option value="Todos">Todos os status</option>
                <option value="Pendente">Pendente</option>
                <option value="Parcial">Parcial</option>
                <option value="Pago">Pago</option>
              </select>
            </div>
          </div>

          <div style={cardStyle}>
            <h2>Contribuintes do terreno</h2>

            <div style={{ display: "grid", gap: 16 }}>
              {pessoasFiltradas.map((p) => {
                const totalPessoa = 1000;
                const faltando = totalPessoa - Number(p.totalPago || 0);
                const estaEditando = editandoId === p.id;

                return (
                  <div key={p.id} style={pessoaCardStyle}>
                    {!estaEditando ? (
                      <>
                        <div style={pessoaHeaderStyle}>
                          <div>
                            <h3 style={{ margin: 0 }}>{p.nome}</h3>
                            <div style={{ marginTop: 6, color: "#666" }}>
                              {p.telefone} • {p.ministerio}
                            </div>
                          </div>

                          <div style={acoesStyle}>
                            <span style={badgeStyle}>{p.status}</span>

                            <button
                              style={btnSecondaryStyle}
                              onClick={() => iniciarEdicao(p)}
                            >
                              Editar
                            </button>

                            <button
                              style={btnDangerStyle}
                              onClick={() => excluirPessoa(p.id)}
                            >
                              Excluir
                            </button>
                          </div>
                        </div>

                        <div style={resumoPessoaStyle}>
                          <div>
                            <div style={labelMiniStyle}>Total</div>
                            <strong>{moeda(totalPessoa)}</strong>
                          </div>
                          <div>
                            <div style={labelMiniStyle}>Pago</div>
                            <strong>{moeda(Number(p.totalPago || 0))}</strong>
                          </div>
                          <div>
                            <div style={labelMiniStyle}>Faltando</div>
                            <strong style={{ color: "#b00020" }}>
                              {moeda(faltando)}
                            </strong>
                          </div>
                        </div>

                        <div style={{ marginTop: 16 }}>
                          <div style={{ fontWeight: 700, marginBottom: 8 }}>
                            Parcelas
                          </div>

                          <div style={parcelasWrapStyle}>
                            {p.parcelas?.map((parc) => (
                              <div
                                key={parc.num}
                                style={{
                                  ...parcelaItemStyle,
                                  background: parc.paga
                                    ? "#dff6dd"
                                    : "#f3f3f3",
                                }}
                              >
                                {parc.paga ? "✅" : "⬜"} Parcela {parc.num}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <h3 style={{ marginTop: 0 }}>Editar cadastro</h3>

                        <div style={formGridStyle}>
                          <input
                            style={inputStyle}
                            value={editNome}
                            onChange={(e) => setEditNome(e.target.value)}
                            placeholder="Nome"
                          />

                          <input
                            style={inputStyle}
                            value={editTelefone}
                            onChange={(e) => setEditTelefone(e.target.value)}
                            placeholder="Telefone"
                          />

                          <select
                            style={inputStyle}
                            value={editMinisterio}
                            onChange={(e) =>
                              setEditMinisterio(
                                e.target.value as Ministerio
                              )
                            }
                          >
                            <option value="Furnas">Furnas</option>
                            <option value="Labitare">Labitare</option>
                            <option value="Sede">Sede</option>
                            <option value="Peri">Peri</option>
                            <option value="Ministério no Tempo">
                              Ministério no Tempo
                            </option>
                          </select>

                          <input
                            style={inputStyle}
                            value={editStatus}
                            readOnly
                            placeholder="Status"
                          />

                          <input
                            style={inputStyle}
                            value={editTotalPago}
                            readOnly
                            placeholder="Total pago"
                          />
                        </div>

                        <div style={{ marginTop: 16 }}>
                          <div style={{ fontWeight: 700, marginBottom: 8 }}>
                            Parcelas
                          </div>

                          <div style={parcelasWrapStyle}>
                            {editParcelas.map((parc) => (
                              <button
                                key={parc.num}
                                type="button"
                                style={{
                                  ...btnSecondaryStyle,
                                  background: parc.paga
                                    ? "#dff6dd"
                                    : "#f3f3f3",
                                }}
                                onClick={() =>
                                  toggleParcelaEdicao(parc.num)
                                }
                              >
                                {parc.paga ? "✅" : "⬜"} Parcela {parc.num}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div style={acoesStyle}>
                          <button
                            style={btnPrimaryStyle}
                            onClick={() => salvarEdicao(p.id)}
                          >
                            Salvar alterações
                          </button>

                          <button
                            style={btnSecondaryStyle}
                            onClick={cancelarEdicao}
                          >
                            Cancelar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {pessoasFiltradas.length === 0 && (
                <div style={{ color: "#666" }}>
                  Nenhum contribuinte encontrado.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {aba === "entradas" && (
        <>
          <div style={cardStyle}>
            <h2>Registrar entrada da igreja</h2>

            <div style={formGridStyle}>
              <input
                style={inputStyle}
                type="date"
                value={entradaData}
                onChange={(e) => setEntradaData(e.target.value)}
              />

              <select
                style={inputStyle}
                value={entradaTipo}
                onChange={(e) =>
                  setEntradaTipo(e.target.value as TipoEntrada)
                }
              >
                <option value="Dízimo">Dízimo</option>
                <option value="Oferta">Oferta</option>
                <option value="Doação">Doação</option>
                <option value="Campanha">Campanha</option>
                <option value="Evento">Evento</option>
                <option value="Outros">Outros</option>
              </select>

              <input
                style={inputStyle}
                placeholder="Nome"
                value={entradaNome}
                onChange={(e) => setEntradaNome(e.target.value)}
              />

              <input
                style={inputStyle}
                placeholder="Valor"
                value={entradaValor}
                onChange={(e) => setEntradaValor(e.target.value)}
              />

              <input
                style={inputStyle}
                placeholder="Forma de pagamento"
                value={entradaFormaPagamento}
                onChange={(e) =>
                  setEntradaFormaPagamento(e.target.value)
                }
              />

              <input
                style={inputStyle}
                placeholder="Observação"
                value={entradaObservacao}
                onChange={(e) =>
                  setEntradaObservacao(e.target.value)
                }
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <button style={btnPrimaryStyle} onClick={adicionarEntrada}>
                Salvar entrada
              </button>
            </div>
          </div>

          <div style={cardStyle}>
            <h2>Entradas registradas</h2>

            <div style={{ display: "grid", gap: 12 }}>
              {entradas.map((e) => (
                <div key={e.id} style={itemFinanceiroStyle}>
                  <div>
                    <strong>{e.tipo}</strong> • {e.nome}
                    <div style={{ color: "#666", marginTop: 4 }}>
                      {e.data} • {e.formaPagamento}
                    </div>
                    {e.observacao && (
                      <div style={{ color: "#666", marginTop: 4 }}>
                        {e.observacao}
                      </div>
                    )}
                  </div>

                  <div style={acoesStyle}>
                    <strong>{moeda(e.valor)}</strong>
                    <button
                      style={btnDangerStyle}
                      onClick={() => excluirEntrada(e.id)}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}

              {entradas.length === 0 && (
                <div style={{ color: "#666" }}>
                  Nenhuma entrada cadastrada.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {aba === "saidas" && (
        <>
          <div style={cardStyle}>
            <h2>Registrar saída da igreja</h2>

            <div style={formGridStyle}>
              <input
                style={inputStyle}
                type="date"
                value={saidaData}
                onChange={(e) => setSaidaData(e.target.value)}
              />

              <select
                style={inputStyle}
                value={saidaCategoria}
                onChange={(e) =>
                  setSaidaCategoria(
                    e.target.value as CategoriaSaida
                  )
                }
              >
                <option value="Água">Água</option>
                <option value="Luz">Luz</option>
                <option value="Internet">Internet</option>
                <option value="Aluguel">Aluguel</option>
                <option value="Manutenção">Manutenção</option>
                <option value="Conserto">Conserto</option>
                <option value="Material">Material</option>
                <option value="Ajuda social">Ajuda social</option>
                <option value="Outros">Outros</option>
              </select>

              <input
                style={inputStyle}
                placeholder="Descrição"
                value={saidaDescricao}
                onChange={(e) => setSaidaDescricao(e.target.value)}
              />

              <input
                style={inputStyle}
                placeholder="Valor"
                value={saidaValor}
                onChange={(e) => setSaidaValor(e.target.value)}
              />

              <input
                style={inputStyle}
                placeholder="Forma de pagamento"
                value={saidaFormaPagamento}
                onChange={(e) =>
                  setSaidaFormaPagamento(e.target.value)
                }
              />

              <input
                style={inputStyle}
                placeholder="Autorizado por"
                value={saidaAutorizadoPor}
                onChange={(e) =>
                  setSaidaAutorizadoPor(e.target.value)
                }
              />

              <input
                style={inputStyle}
                placeholder="Observação"
                value={saidaObservacao}
                onChange={(e) =>
                  setSaidaObservacao(e.target.value)
                }
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <button style={btnPrimaryStyle} onClick={adicionarSaida}>
                Salvar saída
              </button>
            </div>
          </div>

          <div style={cardStyle}>
            <h2>Saídas registradas</h2>

            <div style={{ display: "grid", gap: 12 }}>
              {saidas.map((s) => (
                <div key={s.id} style={itemFinanceiroStyle}>
                  <div>
                    <strong>{s.categoria}</strong> • {s.descricao}
                    <div style={{ color: "#666", marginTop: 4 }}>
                      {s.data} • {s.formaPagamento}
                    </div>
                    {s.autorizadoPor && (
                      <div style={{ color: "#666", marginTop: 4 }}>
                        Autorizado por: {s.autorizadoPor}
                      </div>
                    )}
                    {s.observacao && (
                      <div style={{ color: "#666", marginTop: 4 }}>
                        {s.observacao}
                      </div>
                    )}
                  </div>

                  <div style={acoesStyle}>
                    <strong>{moeda(s.valor)}</strong>
                    <button
                      style={btnDangerStyle}
                      onClick={() => excluirSaida(s.id)}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}

              {saidas.length === 0 && (
                <div style={{ color: "#666" }}>
                  Nenhuma saída cadastrada.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  padding: 24,
  fontFamily: "Arial, sans-serif",
  background: "#f5f5f5",
  minHeight: "100vh",
};

const loginCardStyle: React.CSSProperties = {
  maxWidth: 420,
  margin: "40px auto",
  border: "1px solid #ddd",
  borderRadius: 16,
  padding: 24,
  background: "#fff",
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #ddd",
  borderRadius: 18,
  padding: 20,
  marginBottom: 20,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
};

const menuStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 16,
};

const gridResumoStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginTop: 16,
};

const miniCardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 14,
  padding: 16,
  background: "#fafafa",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const pessoaCardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 16,
  padding: 16,
  background: "#fff",
};

const pessoaHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const resumoPessoaStyle: React.CSSProperties = {
  display: "flex",
  gap: 24,
  flexWrap: "wrap",
  marginTop: 16,
};

const parcelasWrapStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const parcelaItemStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #ccc",
};

const itemFinanceiroStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 14,
  padding: 14,
  background: "#fff",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: "1px solid #ccc",
  fontSize: 16,
  boxSizing: "border-box",
};

const btnPrimaryStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "none",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 700,
};

const btnSecondaryStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #ccc",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 700,
};

const btnDangerStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #c33",
  background: "#fff5f5",
  color: "#a00",
  cursor: "pointer",
  fontWeight: 700,
};

const acoesStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
};

const badgeStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #ccc",
  fontSize: 12,
  fontWeight: 700,
};

const labelMiniStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#666",
  marginBottom: 4,
};