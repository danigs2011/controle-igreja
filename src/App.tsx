import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

const NUM_PARCELAS = 10;
const VALOR_PARCELA = 100;

type Ministerio = "Furnas" | "Labitare" | "Sede" | "Peri" | "Ministério no Tempo";
type Status = "Pendente" | "Parcial" | "Quitado";

type Parcela = {
  num: number; // 1..10
  paga: boolean;
  data?: string; // YYYY-MM-DD
};

type Pessoa = {
  id: string; // id do Firestore
  nome: string;
  telefone: string;
  ministerio: Ministerio;
  status: Status;
  totalPago: number;
  parcelas: Parcela[];
  criadoEm: string; // ISO
};

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function makeParcelas(): Parcela[] {
  return Array.from({ length: NUM_PARCELAS }, (_, i) => ({
    num: i + 1,
    paga: false,
  }));
}

function totalPorPessoa() {
  return NUM_PARCELAS * VALOR_PARCELA;
}

function calcTotalPago(parcelas: Parcela[]) {
  return parcelas.filter((x) => x.paga).length * VALOR_PARCELA;
}

function calcStatus(parcelas: Parcela[]): Status {
  const pagas = parcelas.filter((x) => x.paga).length;
  if (pagas === 0) return "Pendente";
  if (pagas === NUM_PARCELAS) return "Quitado";
  return "Parcial";
}

export default function App() {
  // Form
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [ministerio, setMinisterio] = useState<Ministerio>("Sede");

  // Lista (vem do Firebase)
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);

  // UI
  const [tab, setTab] = useState<"cadastro" | "pesquisa">("cadastro");
  const [selecionada, setSelecionada] = useState<Pessoa | null>(null);

  // filtros
  const [qTxt, setQTxt] = useState("");
  const [fMinisterio, setFMinisterio] = useState<"Todos" | Ministerio>("Todos");
  const [fStatus, setFStatus] = useState<"Todos" | Status>("Todos");

  function limparForm() {
    setNome("");
    setTelefone("");
    setMinisterio("Sede");
  }

  // ✅ Carrega do Firestore em tempo real
  useEffect(() => {
    const q = query(collection(db, "membros"), orderBy("criadoEm", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const lista: Pessoa[] = snap.docs.map((d) => {
          const data: any = d.data();

          // compatível com o que já existe no seu Firebase
          const ministerioDB =
            (data.ministerio ?? data["ministério"] ?? "Sede") as Ministerio;

          const parcelasDB: Parcela[] = Array.isArray(data.parcelas)
            ? data.parcelas
            : makeParcelas();

          const totalPagoDB =
            typeof data.totalPago === "number"
              ? data.totalPago
              : calcTotalPago(parcelasDB);

          const statusDB =
            (data.status as Status) ?? calcStatus(parcelasDB);

          return {
            id: d.id,
            nome: String(data.nome ?? ""),
            telefone: String(data.telefone ?? ""),
            ministerio: ministerioDB,
            parcelas: parcelasDB,
            totalPago: totalPagoDB,
            status: statusDB,
            criadoEm: String(data.criadoEm ?? ""),
          };
        });

        setPessoas(lista);

        if (selecionada) {
          const atual = lista.find((x) => x.id === selecionada.id) ?? null;
          setSelecionada(atual);
        }
      },
      (err) => {
        console.error("Erro lendo Firestore:", err);
        alert("Erro lendo Firestore. Veja o console (F12).");
      }
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totais = useMemo(() => {
    const totalReceber = pessoas.length * totalPorPessoa();
    const pago = pessoas.reduce((acc, p) => acc + (p.totalPago ?? 0), 0);
    return { totalReceber, pago, faltando: totalReceber - pago };
  }, [pessoas]);

  const pessoasFiltradas = useMemo(() => {
    const qLower = qTxt.trim().toLowerCase();
    const qNum = qTxt.replace(/\D/g, "");

    return pessoas.filter((p) => {
      const okBusca =
        !qLower ||
        p.nome.toLowerCase().includes(qLower) ||
        p.telefone.replace(/\D/g, "").includes(qNum);

      const okMin = fMinisterio === "Todos" || p.ministerio === fMinisterio;
      const okSt = fStatus === "Todos" || p.status === fStatus;

      return okBusca && okMin && okSt;
    });
  }, [pessoas, qTxt, fMinisterio, fStatus]);

  // ✅ SALVAR NO FIREBASE (botão Adicionar)
  async function adicionarPessoa() {
    const n = nome.trim();
    const t = telefone.trim();

    if (!n) return alert("Digite o nome.");
    if (!t) return alert("Digite o telefone.");

    const parcelas = makeParcelas();
    const payload = {
      nome: n,
      telefone: t,
      ministerio,
      parcelas,
      totalPago: 0,
      status: "Pendente" as Status,
      criadoEm: new Date().toISOString(),
    };

    try {
      await addDoc(collection(db, "membros"), payload);
      limparForm();
      setTab("pesquisa");
      setSelecionada(null);
    } catch (err) {
      console.error("Erro ao salvar:", err);
      alert("Não consegui salvar no Firebase. Veja o console (F12).");
    }
  }

  async function removerPessoa(id: string) {
    const ok = confirm("Tem certeza que deseja excluir esta pessoa?");
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "membros", id));
      if (selecionada?.id === id) setSelecionada(null);
    } catch (err) {
      console.error("Erro ao excluir:", err);
      alert("Não consegui excluir no Firebase. Veja o console (F12).");
    }
  }

  async function toggleParcela(pessoaId: string, parcelaNum: number) {
    const p = pessoas.find((x) => x.id === pessoaId);
    if (!p) return;

    const novasParcelas = p.parcelas.map((parc) => {
      if (parc.num !== parcelaNum) return parc;
      const novaPaga = !parc.paga;
      return {
        ...parc,
        paga: novaPaga,
        data: novaPaga ? (parc.data ?? todayISO()) : undefined,
      };
    });

    const novoTotalPago = calcTotalPago(novasParcelas);
    const novoStatus = calcStatus(novasParcelas);

    try {
      await updateDoc(doc(db, "membros", pessoaId), {
        parcelas: novasParcelas,
        totalPago: novoTotalPago,
        status: novoStatus,
      });
    } catch (err) {
      console.error("Erro ao atualizar parcela:", err);
      alert("Não consegui atualizar a parcela. Veja o console (F12).");
    }
  }

  const card: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #eaeaea",
    borderRadius: 14,
    padding: 14,
    boxShadow: "0 1px 6px rgba(0,0,0,.04)",
  };

  const input: React.CSSProperties = {
    width: "100%",
    padding: 10,
    borderRadius: 12,
    border: "1px solid #ddd",
    outline: "none",
  };

  const btn: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #ddd",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  };

  const btnPrimary: React.CSSProperties = {
    ...btn,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
  };

  const badge = (st: Status): React.CSSProperties => {
    const base: React.CSSProperties = {
      padding: "6px 10px",
      borderRadius: 999,
      border: "1px solid #ddd",
      fontSize: 12,
      fontWeight: 900,
      background: "#fff",
      display: "inline-block",
    };
    if (st === "Quitado") return { ...base, borderColor: "#1a7f37" };
    if (st === "Parcial") return { ...base, borderColor: "#b8860b" };
    return { ...base, borderColor: "#b42318" };
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f6f6f7", padding: 16 }}>
      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>Controle Igreja</div>
            <div style={{ marginTop: 6, color: "#555" }}>
              {NUM_PARCELAS} parcelas de R$ {VALOR_PARCELA.toFixed(2)} • Total por pessoa:{" "}
              <b>R$ {totalPorPessoa().toFixed(2)}</b>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button style={tab === "cadastro" ? btnPrimary : btn} onClick={() => setTab("cadastro")}>
              Cadastro / Parcelas
            </button>
            <button style={tab === "pesquisa" ? btnPrimary : btn} onClick={() => setTab("pesquisa")}>
              Pesquisa
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <div style={{ ...card, flex: "1 1 180px" }}>
            <div style={{ fontSize: 12, color: "#666", fontWeight: 800 }}>Pessoas</div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>{pessoas.length}</div>
          </div>
          <div style={{ ...card, flex: "1 1 180px" }}>
            <div style={{ fontSize: 12, color: "#666", fontWeight: 800 }}>Total a receber</div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>R$ {totais.totalReceber.toFixed(2)}</div>
          </div>
          <div style={{ ...card, flex: "1 1 180px" }}>
            <div style={{ fontSize: 12, color: "#666", fontWeight: 800 }}>Total pago</div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>R$ {totais.pago.toFixed(2)}</div>
          </div>
          <div style={{ ...card, flex: "1 1 180px" }}>
            <div style={{ fontSize: 12, color: "#666", fontWeight: 800 }}>Total faltando</div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>R$ {totais.faltando.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {tab === "cadastro" && (
        <div style={card}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>Cadastrar pessoa</div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 260px" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#666" }}>Nome</div>
              <input style={input} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" />
            </div>

            <div style={{ flex: "1 1 220px" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#666" }}>Telefone</div>
              <input
                style={input}
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="11999999999"
              />
            </div>

            <div style={{ flex: "1 1 240px" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#666" }}>Ministério</div>
              <select style={input} value={ministerio} onChange={(e) => setMinisterio(e.target.value as Ministerio)}>
                <option>Furnas</option>
                <option>Labitare</option>
                <option>Sede</option>
                <option>Peri</option>
                <option>Ministério no Tempo</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            <button style={btnPrimary} onClick={adicionarPessoa}>
              Adicionar
            </button>
            <button style={btn} onClick={() => setTab("pesquisa")}>
              Ir para Pesquisa
            </button>
          </div>
        </div>
      )}

      {tab === "pesquisa" && (
        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Pesquisa</div>
            <button style={btn} onClick={() => setSelecionada(null)}>
              Fechar parcelas
            </button>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <div style={{ flex: "2 1 280px" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#666" }}>Buscar (nome/telefone)</div>
              <input
                style={input}
                value={qTxt}
                onChange={(e) => setQTxt(e.target.value)}
                placeholder="Digite para pesquisar..."
              />
            </div>

            <div style={{ flex: "1 1 220px" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#666" }}>Ministério</div>
              <select style={input} value={fMinisterio} onChange={(e) => setFMinisterio(e.target.value as any)}>
                <option value="Todos">Todos</option>
                <option>Furnas</option>
                <option>Labitare</option>
                <option>Sede</option>
                <option>Peri</option>
                <option>Ministério no Tempo</option>
              </select>
            </div>

            <div style={{ flex: "1 1 200px" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#666" }}>Status</div>
              <select style={input} value={fStatus} onChange={(e) => setFStatus(e.target.value as any)}>
                <option value="Todos">Todos</option>
                <option value="Pendente">Pendente</option>
                <option value="Parcial">Parcial</option>
                <option value="Quitado">Quitado</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
            <div style={{ flex: "1 1 520px", minWidth: 420 }}>
              <div style={{ display: "grid", gap: 10 }}>
                {pessoasFiltradas.map((p) => {
                  const falt = totalPorPessoa() - (p.totalPago ?? 0);

                  return (
                    <div key={p.id} style={{ ...card }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontWeight: 900, fontSize: 16 }}>{p.nome}</div>
                          <div style={{ color: "#666", fontSize: 13 }}>
                            {p.telefone} • {p.ministerio}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <span style={badge(p.status)}>{p.status}</span>
                          <button style={btn} onClick={() => setSelecionada(p)}>
                            Ver parcelas
                          </button>
                          <button style={btn} onClick={() => removerPessoa(p.id)}>
                            Excluir
                          </button>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 12 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 900, color: "#666" }}>Total</div>
                          <div style={{ fontWeight: 900 }}>R$ {totalPorPessoa().toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 900, color: "#666" }}>Pago</div>
                          <div style={{ fontWeight: 900 }}>R$ {(p.totalPago ?? 0).toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 900, color: "#666" }}>Faltando</div>
                          <div style={{ fontWeight: 900, color: "#b42318" }}>R$ {falt.toFixed(2)}</div>
                        </div>
                      </div>

                      {selecionada?.id === p.id && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontWeight: 900, marginBottom: 8 }}>Parcelas</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {p.parcelas.map((parc) => (
                              <button
                                key={parc.num}
                                style={{
                                  ...btn,
                                  borderColor: parc.paga ? "#1a7f37" : "#ddd",
                                  minWidth: 100,
                                }}
                                title={parc.data ? `Pago em ${parc.data}` : "Não pago"}
                                onClick={() => toggleParcela(p.id, parc.num)}
                              >
                                {parc.paga ? "✅" : "⬜"} Parcela {parc.num}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {pessoasFiltradas.length === 0 && <div style={{ color: "#666" }}>Nenhuma pessoa encontrada.</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}