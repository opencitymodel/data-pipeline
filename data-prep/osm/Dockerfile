FROM amazonlinux:latest

ENV PYSHORT 3.6
ENV PYTHONVER 3.6.8

RUN yum -y install unzip aws-cli

RUN yum -y groupinstall "Development tools"
RUN yum -y install zlib-devel
RUN yum -y install bzip2-devel openssl-devel ncurses-devel
RUN yum -y install sqlite sqlite-devel xz-devel
RUN yum -y install readline-devel tk-devel gdbm-devel db4-devel
RUN yum -y install libpcap-devel xz-devel
RUN yum -y install libjpeg-devel
RUN yum -y install wget

WORKDIR /tmp

RUN wget --no-check-certificate https://www.python.org/ftp/python/${PYTHONVER}/Python-${PYTHONVER}.tgz
RUN tar -zxvf Python-${PYTHONVER}.tgz

WORKDIR /tmp/Python-${PYTHONVER}
RUN ./configure --prefix=/usr/local LDFLAGS="-Wl,-rpath /usr/local/lib" --with-ensurepip=install
RUN make && make altinstall
RUN pip3.6 install virtualenv
RUN pip3.6 install osmium

WORKDIR /root
RUN rm -r /tmp/Python-${PYTHONVER}

ADD export-osm.sh /tmp/export-osm.sh
ADD extract-osm-buildings.py /tmp/extract-osm-buildings.py
RUN chmod 755 /tmp/*.sh
WORKDIR /tmp
USER nobody

ENTRYPOINT ["/tmp/export-osm.sh"]
