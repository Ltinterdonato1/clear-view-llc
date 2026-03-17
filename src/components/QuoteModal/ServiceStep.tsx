'use client';
import React, { useMemo } from 'react';
import { CheckCircle2, ChevronRight, Layout, Waves, Droplets, PlusCircle, Check, ChevronLeft, Minus, Plus, Wind } from 'lucide-react';

interface ServiceStepProps {
  formData: any; 
  setFormData: (data: any) => void;
  stats: any; 
  onNext: () => void; 
  onBack: () => void;
}

export default function ServiceStep({ formData, setFormData, stats, onNext, onBack }: ServiceStepProps) {

  const ensureServiceActive = (service: string, currentServices: string[]) => {
    if (!currentServices.includes(service)) {
      return [...currentServices, service];
    }
    return currentServices;
  };

  const toggleService = (service: string) => {
    const current = formData.selectedServices || [];
    const next = current.includes(service) 
      ? current.filter((s: string) => s !== service) 
      : [...current, service];
    
    setFormData({ ...formData, selectedServices: next });
  };

  const ExtraBadge = ({ active, label, onClick }: { active: boolean, label: string, onClick: () => void }) => (
    <button 
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase transition-all border flex items-center gap-1.5
        ${active ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-white border-slate-200 text-slate-400 hover:border-blue-300'}`}
    >
      {active ? <Check size={10}/> : <PlusCircle size={10}/>}
      {label}
    </button>
  );

  const sExt = Number(formData.skylightCount) || 0;
  const sInt = Number(formData.skylightInteriorCount) || 0;

  const isInvalid = useMemo(() => {
    const selected = formData.selectedServices || [];
    if (selected.length === 0) return true;

    // 1. Window Cleaning Validation
    if (selected.includes('Window Cleaning')) {
      const hasWindows = (Number(formData.windowCount) || 0) > 0;
      const typeSelected = formData.windowType !== 'none';
      if (!hasWindows || !typeSelected) return true;
    }

    // 2. Solar Panel Validation
    if (selected.includes('Solar Panel Cleaning')) {
      const hasPanels = (Number(formData.solarPanelCount) || 0) > 0;
      if (!hasPanels) return true;
    }

    // 3. Pressure Washing Validation (Must select at least one surface)
    if (selected.includes('Pressure Washing')) {
      const hasSurface = 
        formData.trexWash || 
        formData.sidingCleaning || 
        formData.backPatio || 
        (formData.drivewaySize && formData.drivewaySize !== 'none');
      if (!hasSurface) return true;
    }

    // 4. Roof Maintenance Validation (Must select at least one treatment)
    if (selected.includes('Roof Cleaning')) {
      const hasTreatment = 
        formData.roofCleaning || 
        formData.roofBlowOff || 
        formData.mossTreatment || 
        formData.mossAcidWash;
      if (!hasTreatment) return true;
    }

    return false;
  }, [formData]);

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-bottom-4 relative">
      
      {/* TOP NAVIGATION */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300 italic">Step 2 of 4 • Service Selection</span>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-8 text-left">
        
        {/* SUMMARY BOX (Sticky Quote) */}
        <div className="lg:col-span-5 order-first lg:order-last">
          <div className="bg-white rounded-[2.5rem] lg:rounded-[3rem] p-6 lg:p-10 text-slate-900 sticky top-4 shadow-2xl border border-slate-100 overflow-hidden">
            {/* Background Glow Decor */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-50 blur-[80px] rounded-full" />
            
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-6 lg:mb-8 relative z-10">Quote Estimate</h4>
            
            <div className="space-y-4 lg:space-y-5 mb-8 lg:mb-10 min-h-[120px] lg:min-h-[160px] relative z-10">
              {stats?.lineItems?.length > 0 ? (
                stats.lineItems.map((item: any) => (
                  <div key={item.name} className="flex justify-between items-center animate-in slide-in-from-right-4">
                    <span className="text-[10px] lg:text-xs font-bold uppercase tracking-tight text-slate-400">{item.name}</span>
                    <span className="text-sm font-black text-slate-900 italic">+${item.price.toFixed(2)}</span>
                  </div>
                ))
              ) : (
                <div className="py-8 lg:py-10 text-center border border-dashed border-slate-200 rounded-3xl">
                  <p className="text-[9px] lg:text-[10px] font-black uppercase text-slate-300 italic">Select a service to start</p>
                </div>
              )}
              
              {stats?.discounts && stats.discounts.map((d: any) => (
                <div key={d.name} className="flex justify-between items-center text-[10px] text-emerald-600 font-black uppercase italic pt-4 border-t border-slate-50">
                  <span>{d.name}</span><span>-${d.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="pt-6 lg:pt-8 border-t border-slate-100 flex justify-between items-end relative z-10">
              <div>
                <p className="text-[9px] lg:text-[10px] font-black uppercase text-slate-400">Total Investment</p>
                <p className="text-4xl lg:text-5xl font-black italic text-blue-600 leading-none mt-2">${stats?.total || '0.00'}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] lg:text-[10px] font-black uppercase text-slate-400">Est. Time</p>
                <p className="text-lg lg:text-xl font-black italic text-slate-900">{stats?.timeDisplay || '0h'}</p>
              </div>
            </div>

            <button 
              disabled={isInvalid} 
              onClick={onNext} 
              className="w-full mt-8 lg:mt-10 py-5 lg:py-7 bg-blue-600 text-white rounded-3xl lg:rounded-[2.5rem] font-black uppercase italic hover:bg-white hover:text-slate-900 transition-all shadow-xl active:scale-95 group disabled:opacity-20 disabled:grayscale relative z-10"
            >
              Select Date <ChevronRight className="inline ml-1 group-hover:translate-x-1 transition-transform" size={20} />
            </button>
          </div>
        </div>

        {/* SELECTIONS (Left Column) */}
        <div className="lg:col-span-7 space-y-4 lg:space-y-6">
          
          {/* HOME SPECS */}
          <div className="bg-slate-50 p-4 lg:p-6 rounded-[2rem] lg:rounded-[2.5rem] border border-slate-100 grid grid-cols-2 gap-3 lg:gap-4">
            <div className="space-y-2 text-left">
              <label className="text-[9px] lg:text-[10px] font-black ml-2 text-slate-400 uppercase tracking-widest block italic">Stories</label>
              <div className="flex bg-white p-1 rounded-xl lg:rounded-2xl border border-slate-200">
                {[1, 1.5, 2, 3].map(s => (
                  <button 
                    key={s} 
                    onClick={() => setFormData({...formData, stories: s})} 
                    className={`flex-1 py-2 lg:py-2.5 rounded-lg lg:rounded-xl font-black transition-all ${s === 1.5 ? 'text-[8px]' : 'text-xs'} ${formData.stories === s ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {s === 1.5 ? '1+/Basement' : s}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2 text-left">
              <label className="text-[9px] lg:text-[10px] font-black ml-2 text-slate-400 uppercase tracking-widest block italic">Home Size</label>
              <select 
                value={formData.homeSize} 
                onChange={(e) => setFormData({...formData, homeSize: e.target.value})} 
                className="w-full p-2.5 lg:p-3 bg-white border border-slate-200 rounded-xl lg:rounded-2xl font-black text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="1-2">1-2 Bed (Up to 2,500 sq ft)</option>
                <option value="3-4">3-4 Bed (2,500 — 4,000 sq ft)</option>
                <option value="5+">5+ Bed (4,000 — 6,000 sq ft)</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 lg:space-y-4">
            
            {/* WINDOW CLEANING CARD */}
            <div 
              className={`p-4 lg:p-6 rounded-[2rem] lg:rounded-[2.5rem] border-2 transition-all cursor-pointer bg-white ${formData.selectedServices.includes('Window Cleaning') ? 'border-blue-600 ring-4 lg:ring-8 ring-blue-500/5' : 'border-slate-100 hover:border-blue-100'}`} 
              onClick={() => toggleService('Window Cleaning')}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3 lg:gap-4">
                  <div className={`p-3 lg:p-4 rounded-xl ${formData.selectedServices.includes('Window Cleaning') ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-100 text-slate-400'}`}>
                    <Layout size={20} className="lg:w-6 lg:h-6" />
                  </div>
                  <h4 className="font-black uppercase italic text-slate-900 text-base lg:text-lg">Window Cleaning</h4>
                </div>
                {formData.selectedServices.includes('Window Cleaning') && <CheckCircle2 className="text-blue-600 shrink-0" size={20}/>}
              </div>
              
              {formData.selectedServices.includes('Window Cleaning') && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                  
                  <div className="space-y-3">
                    <span className="text-[10px] font-black uppercase text-slate-900 italic block">Regular Windows ($8 per side / $14 both)</span>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
                        {[
                          { label: 'EXT', type: 'exterior' },
                          { label: 'INT', type: 'interior' },
                          { label: 'Exterior/Interior', type: 'both' }
                        ].map(t => {
                          const isActive = formData.windowType === t.type;
                          return (
                            <button 
                              key={t.label} 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setFormData({
                                  ...formData, 
                                  windowType: isActive ? 'none' : t.type,
                                  selectedServices: ensureServiceActive('Window Cleaning', formData.selectedServices)
                                });
                              }} 
                              className={`flex-1 sm:flex-none px-3 lg:px-5 py-2 rounded-lg text-[9px] lg:text-[10px] font-black uppercase transition-all ${isActive ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-50'}`}
                            >
                              {t.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className={`flex items-center gap-3 w-full sm:w-auto justify-end transition-opacity ${formData.windowType === 'none' ? 'opacity-20 grayscale pointer-events-none' : 'opacity-100'}`}>
                        <span className="text-[9px] lg:text-[10px] font-black uppercase text-slate-400">Qty:</span>
                        <input 
                          type="number" 
                          min="1" 
                          className="w-14 lg:w-16 p-2 bg-slate-50 border rounded-xl text-center font-black text-xs outline-blue-500" 
                          value={formData.windowCount} 
                          onClick={(e) => e.stopPropagation()} 
                          onChange={(e) => setFormData({
                            ...formData, 
                            windowCount: Math.max(1, parseInt(e.target.value) || 1),
                            selectedServices: ensureServiceActive('Window Cleaning', formData.selectedServices)
                          })}
                        />
                      </div>
                    </div>
                    {formData.windowType !== 'none' && (
                      <div className="flex flex-wrap gap-2 animate-in fade-in">
                        <ExtraBadge label="Screen Cleaning" active={formData.deluxeWindow} onClick={() => setFormData({...formData, deluxeWindow: !formData.deluxeWindow, selectedServices: ensureServiceActive('Window Cleaning', formData.selectedServices)})} />
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-50 space-y-4">
                    <span className="text-[10px] font-black uppercase text-slate-900 italic block">Skylights (Ext $13.50 / Exterior/Interior $18.00)</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                        <span className="text-[9px] font-black uppercase text-slate-400 block">Exterior Skylights</span>
                        <div className="flex items-center justify-between">
                          <button onClick={(e) => { e.stopPropagation(); setFormData({...formData, skylightCount: Math.max(0, sExt - 1), selectedServices: ensureServiceActive('Window Cleaning', formData.selectedServices)}); }} className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 shadow-sm transition-all"><Minus size={14}/></button>
                          <span className="font-black text-sm">{sExt}</span>
                          <button onClick={(e) => { e.stopPropagation(); setFormData({...formData, skylightCount: sExt + 1, selectedServices: ensureServiceActive('Window Cleaning', formData.selectedServices)}); }} className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center hover:bg-blue-600 shadow-md transition-all"><Plus size={14}/></button>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                        <span className="text-[9px] font-black uppercase text-slate-400 block">Interior Skylights</span>
                        <div className="flex items-center justify-between">
                          <button onClick={(e) => { e.stopPropagation(); setFormData({...formData, skylightInteriorCount: Math.max(0, sInt - 1), selectedServices: ensureServiceActive('Window Cleaning', formData.selectedServices)}); }} className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 shadow-sm transition-all"><Minus size={14}/></button>
                          <span className="font-black text-sm">{sInt}</span>
                          <button onClick={(e) => { e.stopPropagation(); setFormData({...formData, skylightInteriorCount: sInt + 1, selectedServices: ensureServiceActive('Window Cleaning', formData.selectedServices)}); }} className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center hover:bg-blue-600 shadow-md transition-all"><Plus size={14}/></button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* GUTTER CLEANING CARD */}
            <div 
              className={`p-4 lg:p-6 rounded-[2rem] lg:rounded-[2.5rem] border-2 transition-all cursor-pointer bg-white ${formData.stories === 3 ? 'opacity-40 grayscale cursor-not-allowed' : formData.selectedServices.includes('Gutter Cleaning') ? 'border-blue-600 ring-4 lg:ring-8 ring-blue-500/5' : 'border-slate-100 hover:border-blue-100'}`} 
              onClick={() => formData.stories !== 3 && toggleService('Gutter Cleaning')}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3 lg:gap-4">
                  <div className={`p-3 lg:p-4 rounded-xl ${formData.selectedServices.includes('Gutter Cleaning') ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-100 text-slate-400'}`}>
                    <Waves size={20} className="lg:w-6 lg:h-6" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-black uppercase italic text-slate-900 text-base lg:text-lg">Gutter Cleaning</h4>
                    {formData.stories === 3 && <p className="text-[8px] font-black text-red-500 uppercase">Not available for 3-story</p>}
                  </div>
                </div>
                {formData.selectedServices.includes('Gutter Cleaning') && <CheckCircle2 className="text-blue-600 shrink-0" size={20}/>}
              </div>
              {formData.selectedServices.includes('Gutter Cleaning') && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-2 animate-in fade-in">
                  <ExtraBadge label="Downspout Flush" active={formData.gutterFlush} onClick={() => setFormData({...formData, gutterFlush: !formData.gutterFlush, selectedServices: ensureServiceActive('Gutter Cleaning', formData.selectedServices)})} />
                  <ExtraBadge label="Exterior Gutter Wash" active={formData.deluxeGutter} onClick={() => setFormData({...formData, deluxeGutter: !formData.deluxeGutter, selectedServices: ensureServiceActive('Gutter Cleaning', formData.selectedServices)})} />
                </div>
              )}
            </div>

            {/* PRESSURE WASHING CARD */}
            <div 
              className={`p-4 lg:p-6 rounded-[2rem] lg:rounded-[2.5rem] border-2 transition-all cursor-pointer bg-white ${formData.selectedServices.includes('Pressure Washing') ? 'border-blue-600 ring-4 lg:ring-8 ring-blue-500/5' : 'border-slate-100 hover:border-blue-100'}`} 
              onClick={() => toggleService('Pressure Washing')}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3 lg:gap-4">
                  <div className={`p-3 lg:p-4 rounded-xl ${formData.selectedServices.includes('Pressure Washing') ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-100 text-slate-400'}`}>
                    <Droplets size={20} className="lg:w-6 lg:h-6" />
                  </div>
                  <h4 className="font-black uppercase italic text-slate-900 text-base lg:text-lg">Pressure Washing</h4>
                </div>
                {formData.selectedServices.includes('Pressure Washing') && <CheckCircle2 className="text-blue-600 shrink-0" size={20}/>}
              </div>
              {formData.selectedServices.includes('Pressure Washing') && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 animate-in fade-in text-left">
                  
                  <span className="text-[10px] font-black uppercase text-slate-900 italic block">Driveway Cleaning</span>
                  <div className="grid grid-cols-3 gap-2">
                    {['1-2', '3-4', '5+'].map(size => (
                      <button 
                        key={size} 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setFormData({
                            ...formData, 
                            drivewaySize: formData.drivewaySize === size ? 'none' : size,
                            selectedServices: ensureServiceActive('Pressure Washing', formData.selectedServices)
                          }); 
                        }} 
                        className={`py-3 px-1 rounded-xl text-[8px] lg:text-[9px] font-black uppercase border-2 transition-all ${formData.drivewaySize === size ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-blue-200'}`}
                      >
                        {size} Car<br/>Driveway
                      </button>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-slate-50 space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <ExtraBadge label="Siding Cleaning" active={formData.sidingCleaning} onClick={() => setFormData({...formData, sidingCleaning: !formData.sidingCleaning, selectedServices: ensureServiceActive('Pressure Washing', formData.selectedServices)})} />
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase text-slate-900 italic block">Back Patio & Walkways</span>
                      <div className="relative">
                        <select 
                          value={formData.patioSize} 
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setFormData({
                            ...formData, 
                            patioSize: e.target.value, 
                            backPatio: e.target.value !== 'none',
                            selectedServices: ensureServiceActive('Pressure Washing', formData.selectedServices)
                          })} 
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-xs outline-none appearance-none pr-10"
                        >
                          <option value="none">None</option>
                          <option value="xs">Extra Small — Up to 300 sq ft ($125.00)</option>
                          <option value="small">Small Area — 301 to 700 sq ft ($200.00)</option>
                          <option value="medium">Medium Area — 701 to 1,000 sq ft ($300.00)</option>
                          <option value="large">Large Area — 1,001 to 1,200 sq ft ($325.00)</option>
                          <option value="xl">XL Area — 1,201 to 1,500 sq ft ($400.00)</option>
                          <option value="xxl">XXL Area — 1,501+ sq ft ($500.00+)</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <ChevronRight className="rotate-90 text-slate-400" size={14} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase text-slate-900 italic block">Cedar Fence Restoration</span>
                      <div className="relative">
                        <select 
                          value={formData.fenceSize} 
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setFormData({
                            ...formData, 
                            fenceSize: e.target.value, 
                            cedarFenceRestoration: e.target.value !== 'none',
                            selectedServices: ensureServiceActive('Pressure Washing', formData.selectedServices)
                          })} 
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-xs outline-none appearance-none pr-10"
                        >
                          <option value="none">None</option>
                          <option value="0-25">0 — 25 Linear Feet ($50.00)</option>
                          <option value="26-50">26 — 50 Linear Feet ($100.00)</option>
                          <option value="51-75">51 — 75 Linear Feet ($150.00)</option>
                          <option value="76-100">76 — 100 Linear Feet ($200.00)</option>
                          <option value="101-125">101 — 125 Linear Feet ($250.00)</option>
                          <option value="126-150">126 — 150 Linear Feet ($300.00)</option>
                          <option value="151+">151+ Linear Feet ($400.00+)</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <ChevronRight className="rotate-90 text-slate-400" size={14} />
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase text-slate-900 italic block">Trex Light Acid Wash</span>
                      <div className="relative">
                        <select 
                          value={formData.trexDeckSize} 
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setFormData({
                            ...formData, 
                            trexDeckSize: e.target.value, 
                            trexWash: e.target.value !== 'none',
                            selectedServices: ensureServiceActive('Pressure Washing', formData.selectedServices)
                          })} 
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-xs outline-none appearance-none pr-10"
                        >
                          <option value="none">None</option>
                          <option value="xs">Extra Small — Up to 300 sq ft ($125.00)</option>
                          <option value="small">Small Deck — 301 to 700 sq ft ($200.00)</option>
                          <option value="medium">Medium Deck — 701 to 1,000 sq ft ($300.00)</option>
                          <option value="large">Large Deck — 1,001 to 1,200 sq ft ($325.00)</option>
                          <option value="xl">XL Deck — 1,201 to 1,500 sq ft ($400.00)</option>
                          <option value="xxl">XXL Deck — 1,501+ sq ft ($500.00+)</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <ChevronRight className="rotate-90 text-slate-400" size={14} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ROOF MAINTENANCE CARD */}
            <div 
              className={`p-4 lg:p-6 rounded-[2rem] lg:rounded-[2.5rem] border-2 transition-all cursor-pointer bg-white ${formData.stories === 3 ? 'opacity-40 grayscale cursor-not-allowed' : formData.selectedServices.includes('Roof Cleaning') ? 'border-blue-600 ring-4 lg:ring-8 ring-blue-500/5' : 'border-slate-100 hover:border-blue-100'}`} 
              onClick={() => formData.stories !== 3 && toggleService('Roof Cleaning')}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3 lg:gap-4">
                  <div className={`p-3 lg:p-4 rounded-xl ${formData.selectedServices.includes('Roof Cleaning') ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-100 text-slate-400'}`}>
                    <Wind size={20} className="lg:w-6 lg:h-6" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-black uppercase italic text-slate-900 text-base lg:text-lg">Roof Maintenance</h4>
                    {formData.stories === 3 && <p className="text-[8px] font-black text-red-500 uppercase">Not available for 3-story</p>}
                  </div>
                </div>
                {formData.selectedServices.includes('Roof Cleaning') && <CheckCircle2 className="text-blue-600 shrink-0" size={20}/>}
              </div>
              {formData.selectedServices.includes('Roof Cleaning') && formData.stories !== 3 && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-2 animate-in fade-in">
                  <ExtraBadge label="Standard Roof Blow-off" active={formData.roofBlowOff} onClick={() => setFormData({...formData, roofBlowOff: !formData.roofBlowOff, selectedServices: ensureServiceActive('Roof Cleaning', formData.selectedServices)})} />
                  <ExtraBadge label="Baking Soda Treatment" active={formData.mossTreatment} onClick={() => setFormData({...formData, mossTreatment: !formData.mossTreatment, selectedServices: ensureServiceActive('Roof Cleaning', formData.selectedServices)})} />
                  <ExtraBadge label="Light Acid Wash" active={formData.mossAcidWash} onClick={() => setFormData({...formData, mossAcidWash: !formData.mossAcidWash, selectedServices: ensureServiceActive('Roof Cleaning', formData.selectedServices)})} />
                  <p className="text-[8px] font-black text-slate-400 uppercase ml-2 italic leading-relaxed w-full mt-2">
                    *Baking soda is a light maintenance treatment.<br/>
                    *4% Acid wash is for heavy moss removal. We do not pressure wash roofs.
                  </p>
                </div>
              )}
            </div>

            {/* SOLAR PANEL CLEANING CARD */}
            <div 
              className={`p-4 lg:p-6 rounded-[2rem] lg:rounded-[2.5rem] border-2 transition-all cursor-pointer bg-white ${formData.stories === 3 ? 'opacity-40 grayscale cursor-not-allowed' : formData.selectedServices.includes('Solar Panel Cleaning') ? 'border-blue-600 ring-4 lg:ring-8 ring-blue-500/5' : 'border-slate-100 hover:border-blue-100'}`} 
              onClick={() => formData.stories !== 3 && toggleService('Solar Panel Cleaning')}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3 lg:gap-4">
                  <div className={`p-3 lg:p-4 rounded-xl ${formData.selectedServices.includes('Solar Panel Cleaning') ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-100 text-slate-400'}`}>
                    <PlusCircle size={20} className="lg:w-6 lg:h-6" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-black uppercase italic text-slate-900 text-base lg:text-lg">Solar Panel Cleaning</h4>
                    {formData.stories === 3 && <p className="text-[8px] font-black text-red-500 uppercase">Not available for 3-story</p>}
                  </div>
                </div>
                {formData.selectedServices.includes('Solar Panel Cleaning') && <CheckCircle2 className="text-blue-600 shrink-0" size={20}/>}
              </div>
              {formData.selectedServices.includes('Solar Panel Cleaning') && formData.stories !== 3 && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 animate-in fade-in">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Number of Panels ($15.00 per panel)</span>
                    <div className="flex items-center justify-between">
                      <button onClick={(e) => { e.stopPropagation(); setFormData({...formData, solarPanelCount: Math.max(0, (formData.solarPanelCount || 0) - 1), selectedServices: ensureServiceActive('Solar Panel Cleaning', formData.selectedServices)}); }} className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 shadow-sm transition-all"><Minus size={14}/></button>
                      <span className="font-black text-sm">{formData.solarPanelCount || 0}</span>
                      <button onClick={(e) => { e.stopPropagation(); setFormData({...formData, solarPanelCount: (formData.solarPanelCount || 0) + 1, selectedServices: ensureServiceActive('Solar Panel Cleaning', formData.selectedServices)}); }} className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center hover:bg-blue-600 shadow-md transition-all"><Plus size={14}/></button>
                    </div>
                  </div>
                  <p className="text-[8px] font-black text-slate-400 uppercase ml-2 italic leading-relaxed w-full">
                    *We use a specialized pure-water fed pole system for maximum efficiency and safety.
                  </p>
                </div>
              )}
            </div>

            {/* BACK BUTTON */}
            <div className="pt-8">
              <button 
                onClick={onBack}
                className="w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 hover:text-slate-900 transition-colors flex items-center justify-center gap-2 italic"
              >
                <ChevronLeft size={14}/> Back to Personal Details
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
