-- /getUsersTienda/{id} --
SELECT t.id, t.tienda, t.cadenas_id, t.numero , c.cadena 
	FROM usuarios_has_tiendas ut 
INNER JOIN tiendas t
	ON ut.tiendas_id = t.id 
INNER JOIN usuarios u 
	ON ut.usuarios_id = u.id 
	AND ut.usuarios_id = 2 
INNER JOIN cadenas c 
	ON t.cadenas_id = c.id;

-- :::::::::::::::::::::::::: --

-- /saveActividad --
