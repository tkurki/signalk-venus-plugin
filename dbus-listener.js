const dbus = require('dbus-native')
const debug = require('debug')('vedirect:dbus')

module.exports = function (paths, messageCallback) {
  const bus = process.env.DBUS_SESSION_BUS_ADDRESS ? dbus.sessionBus() : dbus.systemBus()

  if (!bus) {
    throw new Error('Could not connect to the DBus session bus.')
  }

  function name_owner_changed (m) {
    if (
      m.interface == 'org.freedesktop.DBus' &&
      m.member == 'NameOwnerChanged'
    ) {
      name = m.body[0]
      old_owner = m.body[1]
      new_owner = m.body[2]
      
      if (new_owner != '') {
        console.log(`${new_owner}: ${name}`)
        if ( name.startsWith('com.victronenergy') ) {
          listenToService(name)
        }
      }
    }
  }

  bus.connection.on('message', name_owner_changed)
  bus.addMatch("type='signal',member='NameOwnerChanged'", d => {})

  bus.listNames((props, args) => {
    args.forEach(name => {
      if ( name.startsWith('com.victronenergy') ) {
        listenToService(name)
      }
    });
  });

  function listenToService(name) {
    debug(`found victron service: ${name}`)
    var service = bus.getService(name);
    bus.invoke({
      path: '/DeviceInstance',
      destination: name,
      interface: 'com.victronenergy.BusItem',
      member: "GetValue"
    }, function(err, res) {
      var instance = res[1][0]
      
      var service = bus.getService(name)

      paths.forEach( path => {
          service.getInterface(
            path,
            'com.victronenergy.BusItem', (err, notifications) => {
              if ( !err ) {
                notifications.on('PropertiesChanged', (arguments) => {
                  
                  messageCallback({
                    senderName: name,
                    instance: instance,
                    path: path,
                    text: arguments[0][1][1][0],
                    value: arguments[1][1][1][0]
                  });
                  
                  //console.log(`${name}: ${JSON.stringify(arguments)}`)
                });
              }
            });
      });
    });
  }
    
  // TODO return a function to stop the dbus listener
  return () => {}
}

