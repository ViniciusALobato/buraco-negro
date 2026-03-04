'use client';

import React, { useState, useEffect } from 'react';
import { Plus, X, ChevronLeft, ChevronRight, CircleDollarSign, TrendingUp, Trash2, Save, Settings2, Wallet, Tag, AlertCircle, Orbit } from 'lucide-react';
import { supabase } from '../supabase'; 

export default function Home() {
  const [lancamentosMes, setLancamentosMes] = useState<any[]>([]);
  const [todosLancamentos, setTodosLancamentos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [itemDetalhe, setItemDetalhe] = useState<any | null>(null);
  const [itemPagamento, setItemPagamento] = useState<any | null>(null);
  const [dataReferencia, setDataReferencia] = useState(new Date());
  const [carregando, setCarregando] = useState(false);

  // Estados para Novo Lançamento
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [observacao, setObservacao] = useState('');
  const [tipo, setTipo] = useState<'despesa' | 'receita'>('despesa');
  const [catSel, setCatSel] = useState('');
  const [contaSel, setContaSel] = useState('');
  const [metodoPgto, setMetodoPgto] = useState<'a_vista' | 'a_prazo' | 'fixo'>('a_vista');
  const [dataL, setDataL] = useState(new Date().toISOString().split('T')[0]);

  // Estados para Pagamento (Baixa)
  const [valorPagoInput, setValorPagoInput] = useState('');
  const [contaPagamento, setContaPagamento] = useState('');

  const buscarConfiguracoes = async () => {
    const { data: cats } = await supabase.from('categorias').select('*').order('nome');
    const { data: cnts } = await supabase.from('contas').select('*').order('nome');
    if (cats) setCategorias(cats);
    if (cnts) setContas(cnts);
  };

  const buscarDados = async () => {
    const inicioMes = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth(), 1).toISOString();
    const fimMes = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth() + 1, 0, 23, 59, 59).toISOString();
    
    const { data: logs } = await supabase
      .from('lancamentos')
      .select('*')
      .or(`and(data.gte.${inicioMes},data.lte.${fimMes}),and(tipo_movimentacao.eq.despesa,status_pagamento.neq.pago,data.lt.${inicioMes})`);
    
    if (logs) {
      const ordenado = logs.sort((a, b) => {
        const isAtrasadoA = a.data < inicioMes && a.status_pagamento !== 'pago' ? 0 : 1;
        const isAtrasadoB = b.data < inicioMes && b.status_pagamento !== 'pago' ? 0 : 1;
        if (isAtrasadoA !== isAtrasadoB) return isAtrasadoA - isAtrasadoB;
        const pA = a.status_pagamento !== 'pago' ? 0 : 1;
        const pB = b.status_pagamento !== 'pago' ? 0 : 1;
        if (pA !== pB) return pA - pB;
        return new Date(b.data).getTime() - new Date(a.data).getTime();
      });
      setLancamentosMes(ordenado);
    }
    
    const { data: dAll } = await supabase.from('lancamentos').select('tipo_movimentacao, valor_pago');
    if (dAll) setTodosLancamentos(dAll);
  };

  useEffect(() => { buscarConfiguracoes(); buscarDados(); }, [dataReferencia]);

  const addRapido = async (tabela: 'categorias' | 'contas') => {
    const nome = prompt(`Nome da nova ${tabela === 'categorias' ? 'categoria' : 'conta'}:`);
    if (!nome) return;
    const { error } = await supabase.from(tabela).insert([{ nome }]);
    if (!error) buscarConfiguracoes();
  };

  const excluirConfig = async (tabela: 'categorias' | 'contas', id: string) => {
    if (confirm("Remover opção?")) {
      await supabase.from(tabela).delete().eq('id', id);
      buscarConfiguracoes();
    }
  };

  const handleExcluir = async (item: any) => {
    if (!confirm(`Excluir "${item.descricao}"?`)) return;

    if (item.id_recorrencia && confirm("Deseja excluir também todos os meses futuros desta despesa fixa?")) {
      await supabase.from('lancamentos').delete().eq('id_recorrencia', item.id_recorrencia).gte('data', item.data);
    } else {
      await supabase.from('lancamentos').delete().eq('id', item.id);
    }
    buscarDados();
  };

  const salvar = async () => {
    if (carregando) return;
    const vTotal = parseFloat(valor.replace(',', '.'));
    if (isNaN(vTotal) || vTotal <= 0) return alert("Valor inválido");
    setCarregando(true);
    const idRec = crypto.randomUUID();
    const dataHoraLog = new Date().toLocaleString('pt-BR');

    try {
      if (tipo === 'despesa' && metodoPgto === 'fixo') {
        const inserts = [];
        for (let i = 0; i < 12; i++) {
          const d = new Date(dataL + "T00:00:00");
          d.setMonth(d.getMonth() + i);
          inserts.push({ 
            descricao, valor: vTotal, tipo_movimentacao: 'despesa', categoria: catSel, 
            status_pagamento: 'pendente', valor_pago: 0, data: d.toISOString().split('T')[0], 
            id_recorrencia: idRec, observacao: `[FIXO] Lançado em ${dataHoraLog}\n${observacao}`.trim()
          });
        }
        await supabase.from('lancamentos').insert(inserts);
      } else {
        const isPago = tipo === 'receita' || metodoPgto === 'a_vista';
        await supabase.from('lancamentos').insert([{ 
          descricao, valor: vTotal, tipo_movimentacao: tipo, categoria: catSel, 
          conta: isPago ? contaSel : null, 
          status_pagamento: isPago ? 'pago' : 'pendente', 
          valor_pago: isPago ? vTotal : 0, 
          data: dataL, 
          observacao: `Lançado em ${dataHoraLog} (${metodoPgto.replace('_',' ')})\n${observacao}`.trim()
        }]);
      }
      setIsModalOpen(false); setDescricao(''); setValor(''); setCarregando(false); buscarDados();
    } catch (e) { setCarregando(false); }
  };

  const atualizarLancamento = async () => {
    if (!itemDetalhe) return;
    const { id, id_recorrencia, descricao, valor, observacao, data } = itemDetalhe;
    let query = supabase.from('lancamentos').update({ 
      descricao, valor: parseFloat(String(valor)),
      observacao: observacao + `\n[EDITADO] em ${new Date().toLocaleString('pt-BR')}`
    });

    if (id_recorrencia && confirm("Deseja aplicar esta alteração em todos os meses seguintes desta despesa fixa?")) {
      await query.eq('id_recorrencia', id_recorrencia).gte('data', data);
    } else { await query.eq('id', id); }
    setItemDetalhe(null); buscarDados();
  };

  const confirmarPagamento = async () => {
    if (!itemPagamento) return;
    const vPagoAgora = parseFloat(valorPagoInput.replace(',', '.'));
    const totalJaPago = (itemPagamento.valor_pago || 0) + vPagoAgora;
    const novoLog = `${itemPagamento.observacao || ''}\n[BAIXA] R$ ${vPagoAgora.toFixed(2)} em ${new Date().toLocaleString('pt-BR')} via ${contaPagamento}`.trim();
    await supabase.from('lancamentos').update({ 
      valor_pago: totalJaPago, status_pagamento: totalJaPago >= (itemPagamento.valor - 0.01) ? 'pago' : 'parcial', 
      conta: contaPagamento, observacao: novoLog
    }).eq('id', itemPagamento.id);
    setItemPagamento(null); buscarDados();
  };

  const saldoDisponivel = todosLancamentos.filter(l => l.tipo_movimentacao === 'receita').reduce((a, c) => a + (c.valor_pago || 0), 0) - 
                          todosLancamentos.filter(l => l.tipo_movimentacao === 'despesa').reduce((a, c) => a + (c.valor_pago || 0), 0);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-4 pb-24 max-w-md mx-auto font-sans">
      <header className="flex justify-between items-center mb-6 pt-2">
        <div className="flex items-center gap-2">
            <Orbit size={24} className="text-slate-900" />
            <h1 className="text-xl font-black italic tracking-tighter">BURACO NEGRO</h1>
        </div>
        <div className="flex items-center gap-1 bg-white border p-1 rounded-full shadow-sm">
          <button onClick={() => setDataReferencia(new Date(dataReferencia.getFullYear(), dataReferencia.getMonth() - 1, 1))} className="p-1"><ChevronLeft size={16}/></button>
          <span className="text-[9px] font-black uppercase w-20 text-center">{dataReferencia.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}</span>
          <button onClick={() => setDataReferencia(new Date(dataReferencia.getFullYear(), dataReferencia.getMonth() + 1, 1))} className="p-1"><ChevronRight size={16}/></button>
        </div>
      </header>

      <section className="bg-slate-900 text-white p-7 rounded-[2.5rem] mb-4 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10"><TrendingUp size={80}/></div>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Real Disponível</span>
        <h2 className="text-4xl font-black mt-1">R$ {saldoDisponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
      </section>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setIsConfigOpen(true)} className="flex items-center gap-2 bg-white border px-4 py-2 rounded-2xl text-[9px] font-black uppercase shadow-sm active:scale-95 transition-all">
          <Settings2 size={14}/> Categorias e Contas
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {['despesa', 'receita'].map((t) => (
          <section key={t} className="space-y-3">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 flex justify-between px-1">
              <span>{t}s</span>
              <span className={t === 'despesa' ? 'text-red-500' : 'text-emerald-600'}>
                R$ {lancamentosMes.filter(l => l.tipo_movimentacao === t).reduce((a, c) => a + c.valor, 0).toFixed(0)}
              </span>
            </h3>
            {lancamentosMes.filter(l => l.tipo_movimentacao === t).map((item) => {
                const pendente = item.status_pagamento !== 'pago';
                const isAtrasado = item.data.slice(0, 7) < dataReferencia.toISOString().slice(0, 7) && pendente;
                return (
                  <div key={item.id} onClick={() => setItemDetalhe(item)} className={`relative cursor-pointer border-l-4 ${t === 'receita' ? 'border-emerald-500' : (item.status_pagamento === 'pago' ? 'border-blue-500' : 'border-red-500')} bg-white p-3 rounded-r-2xl shadow-sm active:scale-95 transition-all`}>
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-[8px] font-black uppercase ${isAtrasado ? 'text-red-500' : 'text-slate-300'}`}>
                        {item.data.split('-').reverse().slice(0,2).join('/')} {isAtrasado && "• ATRASADO"}
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); handleExcluir(item); }} className="text-slate-200 hover:text-red-400 transition-colors p-1 -mt-1 -mr-1">
                        <Trash2 size={12}/>
                      </button>
                    </div>
                    <p className="text-[10px] font-bold truncate text-slate-800 leading-tight mb-1 pr-4">{item.descricao}</p>
                    <p className={`text-xs font-black ${t === 'receita' ? 'text-emerald-600' : (item.status_pagamento === 'pago' ? 'text-blue-500' : item.valor_pago > 0 ? 'text-orange-500' : 'text-red-500')}`}>R$ {item.valor.toFixed(2)}</p>
                    {t === 'despesa' && (
                      <p className="text-[7px] font-bold text-slate-400 uppercase mt-2 pt-2 border-t border-slate-100 flex flex-col">
                        <span>PAGO: R$ {(item.valor_pago || 0).toFixed(2)}</span>
                        {item.valor - (item.valor_pago || 0) > 0 && <span className="text-orange-600">FALTA: R$ {(item.valor - (item.valor_pago || 0)).toFixed(2)}</span>}
                      </p>
                    )}
                    {t === 'despesa' && pendente && (
                      <button onClick={(e) => { e.stopPropagation(); setItemPagamento(item); setValorPagoInput((item.valor - (item.valor_pago || 0)).toFixed(2)); setContaPagamento(contas[0]?.nome || ''); }} className="absolute bottom-3 right-2 text-emerald-500 bg-emerald-50 p-1 rounded-full shadow-sm"><CircleDollarSign size={14}/></button>
                    )}
                  </div>
                );
            })}
          </section>
        ))}
      </div>

      {/* MODAL CONFIGURAÇÕES */}
      {isConfigOpen && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[120] flex items-end text-slate-900">
          <div className="bg-white w-full rounded-t-[3rem] p-8 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8"><h2 className="text-lg font-black uppercase italic">Categorias e Contas</h2><button onClick={() => setIsConfigOpen(false)} className="p-2"><X/></button></div>
            <div className="space-y-8">
              <div>
                <div className="flex justify-between items-center mb-4"><h3 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2"><Tag size={14}/> Categorias</h3><button onClick={() => addRapido('categorias')} className="p-1 text-emerald-600"><Plus/></button></div>
                <div className="flex flex-wrap gap-2">{categorias.map(c => <div key={c.id} className="bg-slate-50 px-3 py-2 rounded-xl text-[10px] font-bold flex items-center gap-2 border">{c.nome} <button onClick={() => excluirConfig('categorias', c.id)} className="text-red-300"><X size={12}/></button></div>)}</div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-4"><h3 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2"><Wallet size={14}/> Contas</h3><button onClick={() => addRapido('contas')} className="p-1 text-emerald-600"><Plus/></button></div>
                <div className="flex flex-wrap gap-2">{contas.map(c => <div key={c.id} className="bg-slate-50 px-3 py-2 rounded-xl text-[10px] font-bold flex items-center gap-2 border">{c.nome} <button onClick={() => excluirConfig('contas', c.id)} className="text-red-300"><X size={12}/></button></div>)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALHE / EDIÇÃO */}
      {itemDetalhe && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex items-end">
          <div className="bg-white w-full rounded-t-[3rem] p-8 max-h-[85vh] overflow-y-auto shadow-2xl text-slate-900">
            <div className="flex justify-between items-center mb-6"><span className="text-[10px] font-black text-slate-400 uppercase">Editar Registro</span><button onClick={() => setItemDetalhe(null)} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button></div>
            <div className="space-y-5">
              <input value={itemDetalhe.descricao} onChange={e => setItemDetalhe({...itemDetalhe, descricao: e.target.value})} className="w-full text-2xl font-black border-b-2 border-slate-100 pb-2 outline-none focus:border-slate-900" />
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-3xl"><label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Valor</label><input type="number" value={itemDetalhe.valor} onChange={e => setItemDetalhe({...itemDetalhe, valor: e.target.value})} className="w-full bg-transparent text-xl font-black outline-none" /></div>
                <div className="bg-slate-50 p-4 rounded-3xl flex flex-col justify-center"><label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Já Pago</label><span className="text-xl font-black text-emerald-600">R$ {(itemDetalhe.valor_pago || 0).toFixed(2)}</span></div>
              </div>
              <textarea value={itemDetalhe.observacao || ''} onChange={e => setItemDetalhe({...itemDetalhe, observacao: e.target.value})} className="w-full bg-slate-50 p-5 rounded-[2rem] text-xs h-32 outline-none border-2 border-slate-100 resize-none" />
              <button onClick={atualizarLancamento} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-xs flex items-center justify-center gap-3"><Save size={18}/> Salvar Alterações</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BAIXA PAGAMENTO */}
      {itemPagamento && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[110] flex items-center p-6 text-slate-900">
          <div className="bg-white w-full rounded-[2.5rem] p-8 shadow-2xl">
            <h2 className="text-[10px] font-black uppercase text-emerald-600 mb-6 flex items-center gap-2"><CircleDollarSign size={16}/> Baixar Lançamento</h2>
            <div className="space-y-6">
              <input type="text" value={valorPagoInput} onChange={e => setValorPagoInput(e.target.value)} className="w-full text-4xl font-black border-b-4 border-emerald-50 outline-none focus:border-emerald-500" />
              <div className="flex flex-wrap gap-2">
                {contas.map(c => <button key={c.id} onClick={() => setContaPagamento(c.nome)} className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase ${contaPagamento === c.nome ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-400 border'}`}>{c.nome}</button>)}
              </div>
              <button onClick={confirmarPagamento} className="w-full bg-emerald-600 text-white py-5 rounded-[2rem] font-black uppercase text-xs shadow-lg active:scale-95">Efetuar Baixa</button>
              <button onClick={() => setItemPagamento(null)} className="w-full text-slate-300 text-[10px] font-black uppercase text-center">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVO LANÇAMENTO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] flex items-end">
          <div className="bg-white w-full rounded-t-[3rem] p-8 max-h-[95vh] overflow-y-auto text-slate-900">
            <div className="flex justify-between items-center mb-6"><h2 className="text-lg font-black uppercase italic tracking-tighter">Lançar</h2><button onClick={() => setIsModalOpen(false)}><X/></button></div>
            <div className="space-y-4">
              <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl">
                {['despesa', 'receita'].map(t => (
                  <button key={t} onClick={() => setTipo(t as any)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${tipo === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>{t}</button>
                ))}
              </div>
              <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição" className="w-full bg-slate-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-slate-200" />
              <div className="grid grid-cols-2 gap-3">
                <input value={valor} onChange={e => setValor(e.target.value)} placeholder="R$ 0,00" className="bg-slate-50 p-4 rounded-2xl font-black text-lg outline-none" />
                <div className="relative">
                  <select value={catSel} onChange={e => setCatSel(e.target.value)} className="w-full bg-slate-50 p-4 rounded-2xl text-[10px] font-black appearance-none pr-10">
                    <option value="">CATEGORIA</option>
                    {categorias.map(x => <option key={x.id} value={x.nome}>{x.nome}</option>)}
                  </select>
                  <button onClick={() => addRapido('categorias')} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500"><Plus size={18}/></button>
                </div>
              </div>
              {tipo === 'despesa' && (
                <div className="grid grid-cols-3 gap-2">
                  {['a_vista', 'a_prazo', 'fixo'].map(m => (
                    <button key={m} onClick={() => setMetodoPgto(m as any)} className={`py-2 rounded-xl text-[8px] font-black uppercase border-2 ${metodoPgto === m ? 'bg-slate-900 text-white border-slate-900' : 'text-slate-400 border-slate-100'}`}>{m.replace('_', ' ')}</button>
                  ))}
                </div>
              )}
              {(tipo === 'receita' || (tipo === 'despesa' && metodoPgto === 'a_vista')) && (
                 <div className="relative">
                    <select value={contaSel} onChange={e => setContaSel(e.target.value)} className="w-full bg-slate-50 p-4 rounded-2xl text-[10px] font-black appearance-none pr-10">
                        <option value="">CONTA DE ORIGEM/DESTINO</option>
                        {contas.map(x => <option key={x.id} value={x.nome}>{x.nome}</option>)}
                    </select>
                    <button onClick={() => addRapido('contas')} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500"><Plus size={18}/></button>
                 </div>
              )}
              <textarea value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Notas..." className="w-full bg-slate-50 p-4 rounded-2xl text-xs h-20 outline-none resize-none" />
              <input type="date" value={dataL} onChange={e => setDataL(e.target.value)} className="w-full bg-slate-50 p-4 rounded-2xl font-black" />
              <button onClick={salvar} disabled={carregando} className={`w-full py-5 rounded-[2rem] font-black text-white uppercase shadow-xl ${tipo === 'despesa' ? 'bg-slate-900' : 'bg-emerald-600'} ${carregando ? 'opacity-50' : 'active:scale-95'}`}>{carregando ? 'Gravando...' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}

      <button onClick={() => setIsModalOpen(true)} className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white w-16 h-16 rounded-full shadow-2xl flex items-center justify-center z-50 active:scale-90 border-4 border-white"><Plus size={32} /></button>
    </main>
  );
}