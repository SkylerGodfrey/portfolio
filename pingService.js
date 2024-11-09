async function pingDomain(domain) { 
  const response = await fetch(`https://${domain}`);
  if (!response.ok) { 
    throw new Error(`Failed to ping ${domain}`);
  } 
  
  return response.status;
} 

export { pingDomain };