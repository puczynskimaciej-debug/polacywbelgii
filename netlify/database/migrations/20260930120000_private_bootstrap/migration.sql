DO $bootstrap$
BEGIN
  PERFORM pg_advisory_xact_lock(7342168);
  LOCK TABLE cms_users IN EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM cms_audit WHERE action='new-netlify-bootstrap-20260930') THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM cms_users) THEN RAISE EXCEPTION 'Bootstrap requires an empty user table'; END IF;
  IF EXISTS (SELECT 1 FROM ads_settings) THEN RAISE EXCEPTION 'Bootstrap requires empty settings'; END IF;
  INSERT INTO cms_users(id,email,name,password_hash,role,must_change_password)
    VALUES('f2c792fe-8433-44d9-ac77-844c1908a0a4','puczynski.maciej@gmail.com','Maciej Puczynski','scrypt$131072$8$1$3d5e17d2929c5b2de198596a4eec1bec$f14650effe997cc62d97312af9f7b76872919bf1151539c9ccfd848269448adef884573f79dea2aef902aaa100f88acb75c90771bd54b728ced038eebba3e867','admin',false);
  INSERT INTO ads_settings(id,data) VALUES(1,'{"types":{"TOP":{"capacity":2},"STANDARD":{"capacity":10}},"markets":{"pl":{"enabled":true,"currency":"EUR","prices":{"TOP":500,"STANDARD":200}},"nl":{"enabled":true,"currency":"EUR","prices":{"TOP":500,"STANDARD":200}},"fr":{"enabled":true,"currency":"EUR","prices":{"TOP":500,"STANDARD":200}}}}'::jsonb);
  INSERT INTO cms_audit(actor_id,action,target) VALUES('f2c792fe-8433-44d9-ac77-844c1908a0a4','new-netlify-bootstrap-20260930','f2c792fe-8433-44d9-ac77-844c1908a0a4');
END
$bootstrap$;
