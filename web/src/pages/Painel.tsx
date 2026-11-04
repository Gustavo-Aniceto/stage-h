import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { friendlyError } from "../lib/errors";
import { formatDateTime, formatPlate } from "../lib/format";
import type { ActivityRow, DashboardSummary } from "../lib/types";
import { PlateSearch } from "../components/PlateSearch";
import { StatusBadge } from "../components/StatusBadge";
import { CivicStage } from "../components/CivicStage";
import { OFICINA, enderecoTexto } from "../lib/oficina";

const Ico = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden fill="currentColor"><path d={d} /></svg>;
const ICONS = {
  carro: "M18.9 6c-.2-.6-.8-1-1.4-1h-11c-.7 0-1.2.4-1.4 1L3 12v8c0 .6.4 1 1 1h1c.6 0 1-.4 1-1v-1h12v1c0 .6.4 1 1 1h1c.6 0 1-.4 1-1v-8l-2.1-6ZM6.5 16a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm11 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3ZM5 11l1.5-4.5h11L19 11H5Z",
  diagnostico: "M19 8a3 3 0 0 0-1 5.8V16a4 4 0 0 1-8 0v-.1A6 6 0 0 0 15 10V3h-2v2h-1V3h-2v2H9V3H7v7a6 6 0 0 0 4 5.7V16a6 6 0 0 0 12 0v-2.2A3 3 0 0 0 19 8Zm0 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z",
  documento: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm-1 7V3.5L18.5 9H13ZM8 13h8v2H8v-2Zm0 4h8v2H8v-2Z",
  aprovado: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-2 15-5-5 1.4-1.4 3.6 3.6 7.6-7.6L19 8l-9 9Z",
  engrenagem: "M19.1 12.9c0-.3.1-.6.1-.9s0-.6-.1-.9l2-1.6c.2-.1.2-.4.1-.6l-1.9-3.3c-.1-.2-.4-.3-.6-.2l-2.4 1c-.5-.4-1-.7-1.6-.9l-.4-2.5c0-.2-.2-.4-.5-.4h-3.8c-.2 0-.4.2-.5.4l-.4 2.5c-.6.2-1.100.5-1.600.9l-2.400-1c-.2-.1-.5 0-.6.200L2.700 8.900c-.1.200-.1.500.1.600l2 1.600c0 .3-.1.600-.1.900s0 .6.100.9l-2 1.600c-.2.100-.2.400-.1.600l1.900 3.300c.1.200.4.300.6.200l2.400-1c.5.400 1 .7 1.600.9l.4 2.500c0 .2.200.4.500.4h3.800c.2 0 .4-.2.500-.4l.4-2.500c.6-.2 1.100-.5 1.600-.9l2.400 1c.2.100.5 0 .6-.2l1.900-3.300c.1-.2.100-.5-.1-.6l-2-1.600ZM12 15.600a3.600 3.600 0 1 1 0-7.200 3.600 3.600 0 0 1 0 7.200Z",
  bandeira: "M5 3v18h2v-7h4l.4 2H18V5h-5.600L12 3H5Zm2 2h3.200l.4 2H7V5Zm0 4h4.100l.4 2H7V9Zm6.600-2H16v2h-1.600l-.8-2Zm.8 4H16v2h-1.200l-.4-2Z",
};

// Mesmos 7 indicadores e as mesmas chaves de antes. Só mudaram rótulo visual (tone) e ícone.
const TILES: { key: keyof DashboardSummary; label: string; tone: string; icon: string }[] = [
  { key: "em_atendimento", label: "Veículos em atendimento", tone: "neutral", icon: ICONS.carro },
  { key: "aguardando_diagnostico", label: "Aguardando diagnóstico", tone: "roxo", icon: ICONS.diagnostico },
  { key: "orcamentos_pendentes", label: "Orçamentos pendentes", tone: "azul", icon: ICONS.documento },
  { key: "orcamentos_aprovados", label: "Orçamentos aprovados", tone: "verde", icon: ICONS.aprovado },
  { key: "em_execucao", label: "Serviços em execução", tone: "roxo", icon: ICONS.engrenagem },
  { key: "prontos_retirada", label: "Prontos para entrega", tone: "azul", icon: ICONS.carro },
  { key: "concluidas", label: "OS concluídas", tone: "verde", icon: ICONS.bandeira },
];

const InfoIcon = ({ children }: { children: ReactNode }) => <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden fill="currentColor">{children}</svg>;

/** Foca a busca por placa: é por ela que todo atendimento (cadastro e check-in) começa. */
function focusPlate() {
  const el = document.getElementById("plate-input");
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  (el as HTMLInputElement | null)?.focus({ preventScroll: true });
}

export function Painel() {
  const { profile } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const [s, a] = await Promise.all([
      supabase.rpc("dashboard_summary"),
      supabase.rpc("recent_activity", { p_limit: 12 }),
    ]);
    if (s.error || a.error) { setError(friendlyError(s.error ?? a.error)); return; }
    setSummary((s.data as DashboardSummary[])[0] ?? null);
    setActivity(a.data as ActivityRow[]);
  }
  useEffect(() => { load(); }, []);

  const primeiroNome = profile?.full_name.split(" ")[0];

  return (
    <div className="page page-painel">
      <section className="sh-hero" aria-labelledby="h-boas-vindas">
        <CivicStage />
        <div className="sh-hero-copy">
          <p className="sh-greet"><span aria-hidden />Bem-vindo, {primeiroNome}!</p>
          <h1 id="h-boas-vindas" className="sh-title">{OFICINA.nome}</h1>
          <p className="sh-sub">Especialistas em <em>{OFICINA.especialidade}</em><br className="sh-br" /> e manutenção em todas as marcas.</p>
          <div className="sh-cta">
            <button type="button" className="btn btn-primary btn-lg" onClick={focusPlate}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden fill="currentColor"><path d="M22.7 19 13.6 9.900c.9-2.300.4-5-1.500-6.900-2-2-5-2.400-7.400-1.300L9 6 6 9 1.600 4.700C.4 7.100.9 10.100 2.900 12.100c1.900 1.900 4.600 2.400 6.900 1.500l9.100 9.100c.4.400 1 .4 1.400 0l2.300-2.300c.5-.4.5-1.100.1-1.400Z" /></svg>
              Abrir nova ordem
            </button>
            <Link className="btn btn-secondary btn-lg" to="/sistema/ordens">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden fill="currentColor"><path d={ICONS.carro} /></svg>
              Ver ordens
            </Link>
          </div>
        </div>
      </section>

      <dl className="sh-info" aria-label="Dados da oficina">
        <div>
          <InfoIcon><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.800 7-13a7 7 0 0 0-7-7Zm0 9.500A2.500 2.500 0 1 1 12 6.500a2.500 2.500 0 0 1 0 5Z" /></InfoIcon>
          <dt>Endereço</dt>
          <dd>{enderecoTexto()}</dd>
        </div>
        <div>
          <InfoIcon><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.200 14.200L11 13V7h1.500v5.200l4.500 2.700-.8 1.300Z" /></InfoIcon>
          <dt>Horário</dt>
          <dd>{OFICINA.horario[0].dias}, {OFICINA.horario[0].horas}</dd>
        </div>
        <div>
          <InfoIcon><path d="M6.600 10.800a15.200 15.200 0 0 0 6.600 6.600l2.200-2.200c.3-.3.700-.4 1-.2 1.100.4 2.300.6 3.600.6.600 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.500c.6 0 1 .4 1 1 0 1.300.2 2.500.6 3.600.1.300 0 .700-.2 1l-2.300 2.200Z" /></InfoIcon>
          <dt>Telefone</dt>
          <dd><a href={`tel:+${OFICINA.whatsapp}`}>{OFICINA.telefone}</a></dd>
        </div>
      </dl>

      <section className="panel panel-plate">
        <PlateSearch />
      </section>

      {error && (
        <div className="form-error" role="alert">
          {error} <button className="btn btn-link" onClick={load}>Tentar de novo</button>
        </div>
      )}

      <section className="sh-resumo" aria-labelledby="h-patio">
        <h2 id="h-patio" className="section-title"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden fill="currentColor"><path d={ICONS.carro} /></svg>Resumo da Oficina</h2>
        <div className="board">
          {TILES.map((t) => (
            <div key={t.key} className={`tile tile-${t.tone}`}>
              <span className="tile-value">{summary ? summary[t.key] : "–"}</span>
              <span className="tile-label">{t.label}</span>
              <span className="tile-icon"><Ico d={t.icon} /></span>
            </div>
          ))}
        </div>
        {summary && summary.checkins_rascunho > 0 && (
          <p className="muted small">{summary.checkins_rascunho} check-in(s) iniciados e ainda não concluídos não entram na contagem.</p>
        )}
      </section>

      <section aria-labelledby="h-mov">
        <h2 id="h-mov" className="section-title">Últimas movimentações</h2>
        {activity.length === 0 ? (
          <p className="empty">Nenhuma movimentação ainda. Os check-ins e mudanças de status aparecerão aqui.</p>
        ) : (
          <ul className="feed">
            {activity.map((a, i) => (
              <li key={`${a.service_order_id}-${a.created_at}-${i}`} className="feed-item">
                <span className="plate-chip">{formatPlate(a.plate)}</span>
                <div className="feed-main">
                  <p><strong>{a.os_number}</strong> {a.vehicle}</p>
                  <p className="muted small">{formatDateTime(a.created_at)}{a.actor_name ? `, por ${a.actor_name}` : ""}</p>
                </div>
                <StatusBadge status={a.to_status} />
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  );
}
