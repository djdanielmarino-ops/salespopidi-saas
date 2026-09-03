import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BreweryOrder, BreweryOrderItem } from '@/types/database';
import { toast } from 'sonner';

const db = supabase as any;
export function useBreweryOrders() { return useQuery({ queryKey: ['brewery-orders'], queryFn: async () => { const { data, error } = await db.from('brewery_orders').select('*, brewery_order_items(*, beer_types(*), barrel_models(*))').order('created_at', { ascending: false }); if (error) throw error; return data as BreweryOrder[]; } }); }

export function useCreateBreweryOrder() { const qc=useQueryClient(); return useMutation({ mutationFn: async ({ items, ...order }: { supplier:string; expected_delivery_date?:string|null; notes?:string|null; items:Array<{barrel_model_id:string;beer_type_id:string;quantity_ordered:number;unit_cost?:number|null}> }) => { const { data, error }=await db.from('brewery_orders').insert(order).select('*').single(); if(error) throw error; const { error:itemError }=await db.from('brewery_order_items').insert(items.map(item=>({...item,brewery_order_id:data.id}))); if(itemError){ await db.from('brewery_orders').delete().eq('id',data.id); throw itemError; } return data; }, onSuccess:()=>{qc.invalidateQueries({queryKey:['brewery-orders']});toast.success('Pedido à cervejaria criado.');}, onError:(e:Error)=>toast.error(e.message) }); }

export function useSendBreweryOrder(){const qc=useQueryClient();return useMutation({mutationFn:async(id:string)=>{const {data,error}=await supabase.functions.invoke('send-brewery-order',{body:{order_id:id}});if(error)throw error;if(!data?.success)throw new Error(data?.error||'A cervejaria não confirmou o recebimento.');return data;},onSuccess:()=>{qc.invalidateQueries({queryKey:['brewery-orders']});toast.success('Pedido enviado à integração.');},onError:(e:Error)=>toast.error(`Falha no envio: ${e.message}`)});}

export function useReceiveBreweryItem(){const qc=useQueryClient();return useMutation({mutationFn:async({itemId,quantity}:{itemId:string;quantity:number})=>{const {error}=await db.rpc('receive_brewery_order_item',{p_item_id:itemId,p_quantity:quantity});if(error)throw error;},onSuccess:()=>{qc.invalidateQueries({queryKey:['brewery-orders']});qc.invalidateQueries({queryKey:['barrel_inventory']});toast.success('Recebimento registrado no estoque.');},onError:(e:Error)=>toast.error(`Erro no recebimento: ${e.message}`)});}

export function remainingBreweryItem(item:BreweryOrderItem){return Number(item.quantity_ordered)-Number(item.quantity_received);}
