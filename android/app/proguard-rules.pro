# Release R8 rules for Home Repo.
#
# The app holds nothing back reflectively except the Postgres driver, which is
# registered by hand (Db.kt does Class.forName("org.postgresql.Driver") since
# Android does not scan service providers). Everything else the app touches —
# Compose, Material, zxing, kotlinx.serialization — ships with its own
# consumer rules.

-keep class org.postgresql.** { *; }

# pgjdbc references JDK classes (and Windows-only helpers: JNA, waffle, SSPI)
# that do not exist on Android and are never reached from a phone connect.
# The keep-dontwarn list is generated verbatim by AGP's R8 runs, from
# android/app/build/outputs/mapping/release/missing_rules.txt — extend it by
# running a release build and pasting the suggested lines.
-dontwarn java.awt.Point
-dontwarn java.sql.SQLType
-dontwarn javax.security.auth.callback.NameCallback
-dontwarn javax.security.auth.callback.TextOutputCallback
-dontwarn javax.security.auth.login.AppConfigurationEntry$LoginModuleControlFlag
-dontwarn javax.security.auth.login.AppConfigurationEntry
-dontwarn javax.security.auth.login.Configuration
-dontwarn javax.security.auth.login.LoginContext
-dontwarn javax.sql.XAConnection
-dontwarn javax.sql.XADataSource
-dontwarn javax.transaction.xa.XAException
-dontwarn javax.transaction.xa.XAResource
-dontwarn javax.transaction.xa.Xid
-dontwarn javax.xml.stream.XMLInputFactory
-dontwarn javax.xml.stream.XMLOutputFactory
-dontwarn javax.xml.stream.XMLStreamException
-dontwarn javax.xml.stream.XMLStreamReader
-dontwarn javax.xml.stream.XMLStreamWriter
-dontwarn javax.xml.transform.stax.StAXResult
-dontwarn javax.xml.transform.stax.StAXSource
-dontwarn waffle.windows.auth.IWindowsCredentialsHandle
-dontwarn waffle.windows.auth.impl.WindowsCredentialsHandleImpl
-dontwarn waffle.windows.auth.impl.WindowsSecurityContextImpl
-dontwarn com.sun.jna.LastErrorException
-dontwarn com.sun.jna.Native
-dontwarn com.sun.jna.Platform
-dontwarn com.sun.jna.WString
-dontwarn com.sun.jna.platform.win32.Sspi$CtxtHandle
-dontwarn com.sun.jna.platform.win32.Sspi$SecBufferDesc
-dontwarn com.sun.jna.platform.win32.Win32Exception
-dontwarn com.sun.jna.ptr.IntByReference
-dontwarn com.sun.jna.win32.StdCallLibrary
-dontwarn javax.naming.Context
-dontwarn javax.naming.InvalidNameException
-dontwarn javax.naming.Name
-dontwarn javax.naming.RefAddr
-dontwarn javax.naming.Reference
-dontwarn javax.naming.Referenceable
-dontwarn javax.naming.StringRefAddr
-dontwarn javax.naming.ldap.LdapName
-dontwarn javax.naming.ldap.Rdn
-dontwarn javax.naming.spi.ObjectFactory
-dontwarn org.ietf.jgss.GSSContext
-dontwarn org.ietf.jgss.GSSCredential
-dontwarn org.ietf.jgss.GSSException
-dontwarn org.ietf.jgss.GSSManager
-dontwarn org.ietf.jgss.GSSName
-dontwarn org.ietf.jgss.MessageProp
-dontwarn org.ietf.jgss.Oid
-dontwarn org.osgi.framework.BundleActivator
-dontwarn org.osgi.framework.BundleContext
-dontwarn org.osgi.framework.ServiceRegistration
-dontwarn org.osgi.service.jdbc.DataSourceFactory

# Keep every enum's value handling (zxing result types and pgjdbc's own enums).
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}
