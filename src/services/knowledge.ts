import { supabase } from './supabase'

export async function getSAPModules() {
  const { data, error } = await supabase
    .from('sap_modules')
    .select('*')
    .order('module')

  if (error) {
    console.error('Supabase error:', error)
    return []
  }

  return data
}

export async function searchSAPModules(
  keyword: string,
) {
  const { data, error } = await supabase
    .from('sap_modules')
    .select('*')
    .ilike('module', `%${keyword}%`)

  if (error) {
    console.error(error)
    return []
  }

  return data
}